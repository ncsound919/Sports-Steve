"""
src/optimization/parlay_builder.py -- Parlay builder for Sports-Steve.

Implements:
  - Leg and Parlay data classes
  - ParlayBuilder: combines candidate legs into parlays with combined
    odds, win probability, and expected-value calculation
  - ParlayOptimizer: generates optimized parlay candidates, pulling
    real legs from live broker odds feeds via _fetch_legs()
"""

import itertools
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class Leg:
    """A single leg of a parlay."""
    event_id: str
    selection: str
    odds: float
    win_probability: float = 0.0
    game_time_utc: datetime | None = None
    home_tz_offset: float = -5.0
    away_tz_offset: float = -5.0
    away_back_to_back: bool = False
    home_back_to_back: bool = False
    sport: str = "NBA"
    # For PrizePicks: the pick direction ("more" or "less")
    pick: str = "more"
    # The line score at time of leg creation (for edge validation)
    line: float = 0.0
    # The projection_id from PrizePicks (for real placement payload)
    projection_id: str = ""


@dataclass
class Parlay:
    """A candidate parlay to be placed."""
    id: str
    sport: str
    legs: list[Leg] = field(default_factory=list)
    odds: float = 0.0
    recommended_stake: float = 0.0
    expected_value: float = 0.0
    win_probability: float = 0.0


# ---------------------------------------------------------------------------
# Parlay builder
# ---------------------------------------------------------------------------


class ParlayBuilder:
    """
    Combines individual Leg candidates into Parlay objects.

    Responsibilities
    ----------------
    * Compute combined parlay odds (product of decimal leg odds).
    * Estimate parlay win probability (product of individual leg probabilities).
    * Calculate expected value: EV = win_probability * (odds - 1) - (1 - win_probability).
    * Apply optional circadian edge adjustment via CircadianFactoring.
    """

    def __init__(self, use_circadian: bool = True):
        self.use_circadian = use_circadian
        if use_circadian:
            from src.circadian import CircadianFactoring
            self._circadian = CircadianFactoring()
        else:
            self._circadian = None

    def build(
        self,
        legs: list[Leg],
        sport: str,
        bankroll: float = 100.0,
        kelly_fraction: float = 0.25,
        max_exposure_pct: float = 0.20,
    ) -> Parlay:
        """
        Build a Parlay from a list of legs.

        Parameters
        ----------
        legs:
            Individual bet legs (each with decimal odds and win probability).
        sport:
            Sport identifier used for circadian lookup.
        bankroll:
            Current bankroll for stake sizing.
        kelly_fraction:
            Fractional Kelly multiplier.
        max_exposure_pct:
            Maximum fraction of bankroll to stake on any single parlay.

        Returns
        -------
        A Parlay with combined odds, EV and recommended_stake filled in.
        """
        if not legs:
            raise ValueError("Cannot build a parlay with no legs.")

        combined_odds = 1.0
        combined_win_prob = 1.0
        for leg in legs:
            combined_odds *= leg.odds
            if leg.win_probability > 0:
                combined_win_prob *= leg.win_probability

        # Expected value (per unit stake)
        ev = combined_win_prob * (combined_odds - 1.0) - (1.0 - combined_win_prob)

        # Apply circadian adjustment to EV if enabled and game_time data available
        if self._circadian is not None:
            from src.circadian import GameContext
            for leg in legs:
                if leg.game_time_utc is not None:
                    ctx = GameContext(
                        game_time_utc=leg.game_time_utc,
                        home_team_timezone_offset=leg.home_tz_offset,
                        away_team_timezone_offset=leg.away_tz_offset,
                        sport=sport,
                        away_team_back_to_back=leg.away_back_to_back,
                        home_team_back_to_back=leg.home_back_to_back,
                    )
                    adj = self._circadian.compute(ctx)
                    ev = adj.apply(ev)
                    logger.debug(
                        "Circadian adjustment for leg %s: factor=%.4f reasons=%s",
                        leg.event_id, adj.factor, adj.reasons,
                    )

        # Kelly stake sizing
        b = combined_odds - 1.0
        if combined_win_prob > 0 and combined_win_prob < 1 and b > 0:
            kelly_full = (b * combined_win_prob - (1.0 - combined_win_prob)) / b
            if kelly_full > 0:
                stake = min(kelly_full * kelly_fraction * bankroll, bankroll * max_exposure_pct)
            else:
                stake = 0.0
        else:
            stake = 0.0

        return Parlay(
            id=str(uuid.uuid4()),
            sport=sport,
            legs=legs,
            odds=round(combined_odds, 4),
            recommended_stake=round(stake, 2),
            expected_value=round(ev, 4),
            win_probability=round(combined_win_prob, 4),
        )


# ---------------------------------------------------------------------------
# Parlay optimizer
# ---------------------------------------------------------------------------


class ParlayOptimizer:
    """
    Generates optimized parlay candidates from live broker odds feeds.

    Candidate legs are fetched from the brokers registered at construction,
    combined exhaustively up to max_legs, filtered by min_edge (EV threshold),
    and ranked by expected value descending.

    You can also pass candidate_legs directly for testing/backtesting.
    """

    # Default implied win probability used when no explicit probability
    # is provided for a PrizePicks projection (50/50 line).
    DEFAULT_WIN_PROBABILITY = 0.55

    # PrizePicks decimal odds for "more" / "less" picks (no odds field in API)
    PRIZEPICKS_DEFAULT_DECIMAL_ODDS = 1.8182  # approximately -120 American

    def __init__(
        self,
        risk_profile: str = "balanced",
        candidate_legs: list[Leg] | None = None,
        use_circadian: bool = True,
        brokers: dict | None = None,
        **kwargs: Any,
    ):
        self.risk_profile = risk_profile
        self._candidate_legs: list[Leg] = candidate_legs or []
        self._builder = ParlayBuilder(use_circadian=use_circadian)
        self._brokers = brokers or {}
        logger.info(
            "ParlayOptimizer initialized | risk_profile=%s | circadian=%s | "
            "static_legs=%d | brokers=%s",
            risk_profile, use_circadian, len(self._candidate_legs),
            list(self._brokers.keys()),
        )

    # ------------------------------------------------------------------
    # Kelly fraction by risk profile
    # ------------------------------------------------------------------

    @property
    def _kelly_fraction(self) -> float:
        return {"aggressive": 0.50, "balanced": 0.25, "conservative": 0.10}.get(
            self.risk_profile, 0.25
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_optimized_parlays(
        self,
        sports: list[str],
        min_edge: float = 0.05,
        max_legs: int = 3,
        bankroll: float = 1_000.0,
        top_n: int = 10,
    ) -> list[Parlay]:
        """
        Generate optimized parlay candidates.

        Parameters
        ----------
        sports:
            Sports to consider (legs are filtered to these sports).
        min_edge:
            Minimum EV threshold (parlays below this are discarded).
        max_legs:
            Maximum number of legs per parlay.
        bankroll:
            Current bankroll for stake sizing.
        top_n:
            Maximum number of parlays to return (ranked by EV).

        Returns
        -------
        List of Parlay objects sorted by expected_value descending.
        """
        logger.info(
            "Generating parlays | sports=%s min_edge=%.3f max_legs=%d",
            sports, min_edge, max_legs,
        )

        legs = await self._fetch_legs(sports)
        if not legs:
            logger.info("No candidate legs available -- returning empty list.")
            return []

        parlays: list[Parlay] = []
        for n_legs in range(1, max_legs + 1):
            for combo in itertools.combinations(legs, n_legs):
                try:
                    sport = combo[0].sport if hasattr(combo[0], "sport") else sports[0]
                    parlay = self._builder.build(
                        legs=list(combo),
                        sport=sport,
                        bankroll=bankroll,
                        kelly_fraction=self._kelly_fraction,
                    )
                    if parlay.expected_value >= min_edge and parlay.recommended_stake > 0:
                        parlays.append(parlay)
                except Exception:
                    logger.exception("Failed to build parlay from combo")

        parlays.sort(key=lambda p: p.expected_value, reverse=True)
        result = parlays[:top_n]
        logger.info(
            "Optimizer found %d parlay candidates; returning top %d by EV",
            len(parlays), top_n,
        )
        return result

    async def _fetch_legs(self, sports: list[str]) -> list[Leg]:
        """
        Fetch candidate legs from live broker odds feeds.

        For each sport:
          - PrizePicks sports (player props): fetch from PrizePicksBroker
          - DraftKings sports (game lines):   fetch from DraftKingsBroker

        Static candidate_legs (e.g. from tests) are also included and
        filtered by sport.

        Returns a flat list of Leg objects ready for combination.
        """
        legs: list[Leg] = []

        # 1. Static / pre-supplied legs (for testing / backtesting)
        if self._candidate_legs:
            sports_upper = {s.upper() for s in sports}
            legs.extend(
                leg for leg in self._candidate_legs
                if getattr(leg, "sport", sports[0]).upper() in sports_upper
            )

        # 2. Live legs from brokers
        pp_broker = self._brokers.get("prizepicks")
        dk_broker = self._brokers.get("draftkings")

        game_line_sports = {"NFL", "MLB", "NHL", "NCAAFB", "NCAAMB"}
        prop_sports = {"NBA", "WNBA", "MMA", "GOLF", "SOCCER", "ESPORTS"}

        for sport in sports:
            sport_upper = sport.upper()

            # -- PrizePicks props --
            if pp_broker is not None and (sport_upper in prop_sports or sport_upper == "NBA"):
                try:
                    odds_data = await pp_broker.get_odds(sport, [])
                    for proj_id, proj in odds_data.items():
                        leg = self._prizepicks_projection_to_leg(proj_id, proj, sport_upper)
                        if leg is not None:
                            legs.append(leg)
                    logger.info(
                        "Fetched %d PrizePicks projections for %s",
                        len(odds_data), sport_upper,
                    )
                except Exception:
                    logger.exception("Failed to fetch PrizePicks legs for %s", sport_upper)

            # -- DraftKings game lines --
            elif dk_broker is not None and sport_upper in game_line_sports:
                try:
                    odds_data = await dk_broker.get_odds(sport, [])
                    for event_id, game in odds_data.items():
                        new_legs = self._dk_game_to_legs(event_id, game, sport_upper)
                        legs.extend(new_legs)
                    logger.info(
                        "Fetched %d DraftKings games for %s",
                        len(odds_data), sport_upper,
                    )
                except Exception:
                    logger.exception("Failed to fetch DraftKings legs for %s", sport_upper)

        logger.info("Total candidate legs fetched: %d", len(legs))
        return legs

    # ------------------------------------------------------------------
    # Broker data -> Leg conversion helpers
    # ------------------------------------------------------------------

    def _prizepicks_projection_to_leg(
        self, proj_id: str, proj: dict, sport: str
    ) -> Leg | None:
        """
        Convert a PrizePicks projection dict (from get_odds) into a Leg.

        PrizePicks projections are binary over/under bets ("more" or "less").
        We model the "more" side as the default pick and assign a conservative
        default win probability (configurable via DEFAULT_WIN_PROBABILITY).

        Projections marked as promo picks are skipped (they have degraded lines).
        """
        if proj.get("is_promo"):
            return None

        line = proj.get("line", 0.0)
        if not line:
            return None

        # Parse game time if available
        game_time_utc: datetime | None = None
        start_time = proj.get("start_time")
        if start_time:
            try:
                game_time_utc = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass

        # Decimal odds from the API if present, else use default
        raw_odds = proj.get("odds")
        decimal_odds = float(raw_odds) if raw_odds else self.PRIZEPICKS_DEFAULT_DECIMAL_ODDS

        player = proj.get("player", "Unknown")
        stat_type = proj.get("stat_type", "pts")
        selection = f"{player} {stat_type} over {line}"

        return Leg(
            event_id=proj_id,
            projection_id=proj_id,
            selection=selection,
            odds=decimal_odds,
            win_probability=self.DEFAULT_WIN_PROBABILITY,
            game_time_utc=game_time_utc,
            sport=sport,
            pick="more",
            line=float(line),
        )

    def _dk_game_to_legs(
        self, event_id: str, game: dict, sport: str
    ) -> list[Leg]:
        """
        Convert a DraftKings game dict (from get_odds) into legs for the ML,
        spread, and total markets.

        lukhed-sports game structure (approximate):
          {
            "event_id": str,
            "home_team": str,
            "away_team": str,
            "moneyline_home": int  (American odds),
            "moneyline_away": int,
            "spread_home": float,
            "spread_home_odds": int,
            "spread_away": float,
            "spread_away_odds": int,
            "total": float,
            "over_odds": int,
            "under_odds": int,
          }

        We convert American odds to decimal and assign equal win probabilities
        from implied probability (so the Kelly filter will remove negative-EV legs).
        """
        legs: list[Leg] = []

        home = game.get("home_team", "Home")
        away = game.get("away_team", "Away")

        def american_to_decimal(american: int | None) -> float | None:
            if american is None:
                return None
            try:
                a = int(american)
                if a > 0:
                    return round(a / 100 + 1, 4)
                else:
                    return round(100 / abs(a) + 1, 4)
            except (TypeError, ValueError, ZeroDivisionError):
                return None

        def implied_prob(decimal: float) -> float:
            if decimal <= 1.0:
                return 0.0
            return round(1.0 / decimal, 4)

        # Moneyline legs
        for team, key in [(home, "moneyline_home"), (away, "moneyline_away")]:
            odds_dec = american_to_decimal(game.get(key))
            if odds_dec and odds_dec > 1.0:
                win_prob = implied_prob(odds_dec)
                legs.append(Leg(
                    event_id=f"{event_id}_{key}",
                    selection=f"{team} ML",
                    odds=odds_dec,
                    win_probability=win_prob,
                    sport=sport,
                    pick="ml",
                ))

        # Spread legs
        for team, spread_key, odds_key in [
            (home, "spread_home", "spread_home_odds"),
            (away, "spread_away", "spread_away_odds"),
        ]:
            spread = game.get(spread_key)
            odds_dec = american_to_decimal(game.get(odds_key))
            if odds_dec and odds_dec > 1.0 and spread is not None:
                win_prob = implied_prob(odds_dec)
                sign = "+" if float(spread) > 0 else ""
                legs.append(Leg(
                    event_id=f"{event_id}_{odds_key}",
                    selection=f"{team} {sign}{spread}",
                    odds=odds_dec,
                    win_probability=win_prob,
                    sport=sport,
                    pick="spread",
                    line=float(spread),
                ))

        # Total (over/under)
        total = game.get("total")
        for direction, key in [("Over", "over_odds"), ("Under", "under_odds")]:
            odds_dec = american_to_decimal(game.get(key))
            if odds_dec and odds_dec > 1.0 and total is not None:
                win_prob = implied_prob(odds_dec)
                legs.append(Leg(
                    event_id=f"{event_id}_{key}",
                    selection=f"{direction} {total}",
                    odds=odds_dec,
                    win_probability=win_prob,
                    sport=sport,
                    pick=direction.lower(),
                    line=float(total),
                ))

        return legs