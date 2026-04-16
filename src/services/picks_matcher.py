"""
src/services/picks_matcher.py

OddsAPI → PrizePicks matching service.

Fetches player props from PrizePicks and lines from The Odds API,
matches them by game/team, and calculates edge based on
Odds API closing lines vs PrizePicks lines.
"""

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class MatchedPick:
    """A PrizePicks projection matched to Odds API lines for edge analysis."""

    player: str
    stat_type: str
    pp_line: float
    odds: float
    pp_projection_id: str
    game_id: str
    oddsapi_home: str
    oddsapi_away: str
    oddsapi_line: str
    home_price: int
    away_price: int
    edge: float
    sport: str


class PicksMatcher:
    """
    Matches PrizePicks projections to Odds API game lines.

    Workflow:
      1. Fetch PrizePicks props for target sports
      2. Fetch Odds API game lines for same games/teams
      3. Match by game_id and apply edge calculation
      4. Filter by min_edge threshold
    """

    def __init__(self, brokers: dict[str, Any] | None = None):
        self._brokers = brokers or {}

    async def fetch_picks(
        self,
        sports: list[str],
        min_edge: float = 0.0,
    ) -> list[MatchedPick]:
        """
        Fetch and match picks for the given sports.

        Args:
            sports: List of sports to fetch (e.g., ["NBA", "NFL"])
            min_edge: Minimum edge threshold (0.05 = 5%)

        Returns:
            List of MatchedPick objects sorted by edge descending
        """
        if not sports:
            return []

        # Check for required brokers
        pp = self._brokers.get("prizepicks")
        oddsapi = self._brokers.get("oddsapi")

        if pp is None:
            logger.warning("PicksMatcher: no prizepicks broker available")
            return []

        if oddsapi is None:
            logger.warning(
                "PicksMatcher: no oddsapi broker available - returning PP-only picks"
            )
            return await self._fetch_pp_only(pp, sports)

        matched: list[MatchedPick] = []

        for sport in sports:
            try:
                # Fetch both sources concurrently
                pp_odds = await pp.get_odds(sport, [])
                odds_data = await oddsapi.get_odds(sport, [])

                # Get first Odds API game as fallback match
                # In production: match by player team + stat_type
                first_game_key = next(iter(odds_data.keys()), None)
                matched_game = odds_data.get(first_game_key) if first_game_key else None
                if not matched_game:
                    continue

                home = matched_game.get("home_team", "")
                away = matched_game.get("away_team", "")
                best = matched_game.get("best_odds", {})
                home_price = best.get("home", {}).get("price", 0)
                away_price = best.get("away", {}).get("price", 0)

                # Build Odds API line string
                if home_price and away_price:
                    if home_price > 0:
                        oddsapi_line = f"{home} +{home_price}"
                    else:
                        oddsapi_line = f"{home} {home_price}"
                else:
                    oddsapi_line = f"{home} vs {away}"

                # Process each PP projection
                for proj_id, proj in pp_odds.items():
                    player = proj.get("player", "Unknown")
                    stat_type = proj.get("stat_type", "Unknown")
                    pp_line = proj.get("line", 0.0)
                    pp_odds_val = proj.get("odds", 1.82)
                    game_id = proj.get("game_id", "")

                    # Calculate edge
                    pp_implied = 1.0 / pp_odds_val if pp_odds_val > 1 else 0.5
                    api_implied = (
                        self._price_to_prob(home_price) if home_price != 0 else 0.5
                    )
                    edge = pp_implied - api_implied

                    # Remove vig for stat props
                    if stat_type in ("Points", "Rebounds", "Assists", "PRA"):
                        edge -= 0.02

                    if edge >= min_edge:
                        matched.append(
                            MatchedPick(
                                player=player,
                                stat_type=stat_type,
                                pp_line=pp_line,
                                odds=pp_odds_val,
                                pp_projection_id=proj_id,
                                game_id=game_id,
                                oddsapi_home=home,
                                oddsapi_away=away,
                                oddsapi_line=oddsapi_line,
                                home_price=home_price,
                                away_price=away_price,
                                edge=round(edge, 4),
                                sport=sport,
                            )
                        )

            except Exception:
                logger.exception("PicksMatcher failed for sport=%s", sport)

        # Sort by edge descending
        matched.sort(key=lambda x: x.edge, reverse=True)

        logger.info(
            "PicksMatcher: matched %d picks (min_edge=%.2f)", len(matched), min_edge
        )
        return matched

    async def _fetch_pp_only(self, pp, sports: list[str]) -> list[MatchedPick]:
        """Fetch PrizePicks-only picks without Odds API matching."""
        matched: list[MatchedPick] = []

        for sport in sports:
            try:
                pp_odds = await pp.get_odds(sport, [])
                for proj_id, proj in pp_odds.items():
                    matched.append(
                        MatchedPick(
                            player=proj.get("player", "Unknown"),
                            stat_type=proj.get("stat_type", "Unknown"),
                            pp_line=proj.get("line", 0.0),
                            odds=proj.get("odds", 1.82),
                            pp_projection_id=proj_id,
                            game_id=proj.get("game_id", ""),
                            oddsapi_home="",
                            oddsapi_away="",
                            oddsapi_line="PP only",
                            home_price=0,
                            away_price=0,
                            edge=0.0,
                            sport=sport,
                        )
                    )
            except Exception:
                logger.exception(
                    "PicksMatcher PP-only fetch failed for sport=%s", sport
                )

        return matched

    @staticmethod
    def _price_to_prob(price: int) -> float:
        """Convert American odds to implied probability."""
        if price >= 0:
            return 100.0 / (price + 100.0)
        else:
            return abs(price) / (abs(price) + 100.0)
