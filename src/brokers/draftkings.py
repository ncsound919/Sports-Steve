import asyncio
import time
import logging
from typing import Any, ClassVar

from .base import SportsbookBroker

logger = logging.getLogger(__name__)

# Requires: lukhed-sports>=0.6.0 in requirements.txt
try:
    from lukhed_sports import DkSportsbook
    _DK_AVAILABLE = True
except ImportError:
    _DK_AVAILABLE = False
    logger.warning("lukhed-sports not installed. Run: pip install lukhed-sports")


class DraftKingsBroker(SportsbookBroker):
    """
    DraftKings broker using lukhed-sports for odds retrieval.

    get_odds() wraps the synchronous lukhed-sports call in asyncio.run_in_executor
    so it does not block FastAPI's event loop.

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
            msg = "lukhed-sports is required: pip install lukhed-sports"
            raise ImportError(msg)
        # DkSportsbook handles geo-location internally
        self.client = DkSportsbook()

    async def get_odds(self, sport: str, event_ids: list[str]) -> dict[str, Any]:
        """
        Fetch game lines for a league and filter by event_ids.
        Returns: { event_id: game_data_dict }

        The synchronous lukhed-sports call is offloaded to a thread pool
        executor to avoid blocking the asyncio event loop.
        """
        league = self.LEAGUE_MAP.get(sport.upper(), sport.lower())
        loop = asyncio.get_event_loop()
        try:
            lines = await loop.run_in_executor(
                None,  # uses the default ThreadPoolExecutor
                self.client.get_game_lines_for_league,
                league,
            )
            if event_ids:
                return {
                    game["event_id"]: game
                    for game in lines
                    if game.get("event_id") in event_ids
                }
            # Return all if no filter
            return {game["event_id"]: game for game in lines}
        except Exception:
            logger.exception("DraftKings odds fetch failed for %s", sport)
            return {}

    async def place_bet(self, legs: list[dict], stake: float, odds: float) -> str:
        """
        SIMULATED -- DraftKings has no public bet-placement API.
        Replace with authenticated session logic for production.
        """
        mock_id = f"DK_MOCK_{int(time.time())}"
        logger.info(
            "[SIMULATED] DraftKings bet | id=%s | legs=%d | stake=$%.2f | odds=%s",
            mock_id, len(legs), stake, odds,
        )
        return mock_id

    # Mock bets auto-settle after this many seconds (default: 2 hours)
    MOCK_SETTLE_DELAY: ClassVar[int] = 2 * 60 * 60

    async def check_bet_status(self, bet_id: str) -> dict[str, Any]:
        """
        SIMULATED -- In production, poll DraftKings API or use webhook.

        Mock bets auto-settle after MOCK_SETTLE_DELAY seconds.
        The outcome is deterministic based on the bet timestamp:
        even timestamps -> win, odd -> loss.  This avoids randomness
        in tests while still exercising both settlement paths.
        """
        if bet_id.startswith("DK_MOCK_"):
            try:
                ts = int(bet_id.split("_")[-1])
            except (ValueError, IndexError):
                ts = 0

            age = time.time() - ts
            if age < self.MOCK_SETTLE_DELAY:
                return {
                    "bet_id": bet_id,
                    "status": "pending",
                    "result": None,
                    "source": "simulated",
                }

            # Auto-settle: even timestamp -> win, odd -> loss
            result = "win" if ts % 2 == 0 else "loss"
            logger.info(
                "[SIMULATED] DraftKings bet %s auto-settled after %.0fs: %s",
                bet_id, age, result,
            )
            return {
                "bet_id": bet_id,
                "status": "settled",
                "result": result,
                "source": "simulated",
            }
        # Real implementation would call an authenticated endpoint here
        return {"bet_id": bet_id, "status": "unknown", "result": None}