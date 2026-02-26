import time
import logging
from typing import Any, ClassVar

from .base import SportsbookBroker

logger = logging.getLogger(__name__)

# Requires: lukhed-sports = "^0.6.0" in pyproject.toml
try:
    from lukhed_sports import DkSportsbook
    _DK_AVAILABLE = True
except ImportError:
    _DK_AVAILABLE = False
    logger.warning("lukhed-sports not installed. Run: pip install lukhed-sports")


class DraftKingsBroker(SportsbookBroker):
    """
    DraftKings broker using lukhed-sports for odds retrieval.

    NOTE: Actual bet placement is NOT supported via any public API.
    place_bet() is simulated. For production, you would need an
    authenticated session (Selenium / manual cookie injection).
    """

    LEAGUE_MAP: ClassVar[dict[str, str]] = {
        "NFL": "nfl",
        "NBA": "nba",
        "NHL": "nhl",
        "MLB": "mlb",
        "NCAAFB": "ncaafb",
        "NCAAMB": "ncaamb",
        "MMA": "mma",
        "GOLF": "golf",
        "SOCCER": "soccer",
    }

    def __init__(self):
        if not _DK_AVAILABLE:
            raise ImportError("lukhed-sports is required: pip install lukhed-sports")
        # DkSportsbook handles geo-location internally
        self.client = DkSportsbook()

    async def get_odds(self, sport: str, event_ids: list[str]) -> dict[str, Any]:
        """
        Fetch game lines for a league and filter by event_ids.
        Returns: { event_id: game_data_dict }
        """
        league = self.LEAGUE_MAP.get(sport.upper(), sport.lower())
        try:
            lines = self.client.get_game_lines_for_league(league)
            if event_ids:
                return {
                    game["event_id"]: game
                    for game in lines
                    if game.get("event_id") in event_ids
                }
            # Return all if no filter
            return {game["event_id"]: game for game in lines}
        except Exception as e:
            logger.exception(f"DraftKings odds fetch failed for {sport}: {e}")
            return {}

    async def place_bet(self, legs: list[dict], stake: float, odds: float) -> str:
        """
        SIMULATED — DraftKings has no public bet-placement API.
        Replace with authenticated session logic for production.
        """
        mock_id = f"DK_MOCK_{int(time.time())}"
        logger.info(
            f"[SIMULATED] DraftKings bet | id={mock_id} | "
            f"legs={len(legs)} | stake=${stake:.2f} | odds={odds}"
        )
        return mock_id

    async def check_bet_status(self, bet_id: str) -> dict[str, Any]:
        """
        SIMULATED — In production, poll DraftKings API or use webhook.
        """
        if bet_id.startswith("DK_MOCK_"):
            return {"bet_id": bet_id, "status": "pending", "result": None, "source": "simulated"}
        # Real implementation would call an authenticated endpoint here
        return {"bet_id": bet_id, "status": "unknown", "result": None}
