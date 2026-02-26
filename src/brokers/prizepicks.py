import time
import logging
import asyncio
from typing import Any, ClassVar

import httpx

from .base import SportsbookBroker

logger = logging.getLogger(__name__)

_HTTP_TOO_MANY_REQUESTS = 429


class PrizePicksBroker(SportsbookBroker):
    """
    PrizePicks broker using their public projections API for odds/props retrieval.

    NOTE: place_bet() is simulated — placing real entries requires an
    authenticated session with session cookies + optional 2FA handling.
    """

    BASE_URL = "https://api.prizepicks.com"

    # PrizePicks league IDs (verify periodically — these can change)
    LEAGUE_MAP: ClassVar[dict[str, int]] = {
        "NBA": 7,
        "NFL": 5,
        "NHL": 9,
        "MLB": 3,
        "WNBA": 8,
        "CFB": 11,
        "CBB": 12,
        "MMA": 2,
        "GOLF": 14,
        "ESPORTS": 10,
        "SOCCER": 6,
    }

    def __init__(
        self,
        auth_token: str | None = None,
        max_retries: int = 3,
        retry_delay: float = 2.0,
    ):
        self.auth_token = auth_token
        self.max_retries = max_retries
        self.retry_delay = retry_delay

        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; BettingAgent/3.0)",
            "Referer": "https://app.prizepicks.com/",
            "Accept": "application/json",
        }
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        self.client = httpx.AsyncClient(headers=headers, timeout=15.0)

    async def __aenter__(self) -> "PrizePicksBroker":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.aclose()

    async def _get_with_retry(self, url: str, params: dict) -> dict:
        """GET with exponential-backoff retry on rate-limit (429) or server errors."""
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = await self.client.get(url, params=params)
                if resp.status_code == _HTTP_TOO_MANY_REQUESTS:
                    wait = self.retry_delay * attempt
                    logger.warning(f"PrizePicks rate-limited. Retrying in {wait}s...")
                    await asyncio.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError:
                logger.exception("PrizePicks HTTP error (attempt %s)", attempt)
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(self.retry_delay)
            except httpx.RequestError:
                logger.exception("PrizePicks request error (attempt %s)", attempt)
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(self.retry_delay)
        return {}

    async def get_odds(self, sport: str, _event_ids: list[str]) -> dict[str, Any]:
        """
        Fetch player prop projections for a sport/league.
        Returns: { projection_id: { player, stat_type, line, odds, game_id } }

        _event_ids are ignored (PrizePicks groups by league, not individual games),
        but the game_id is included in each result so callers can filter downstream.
        """
        league_id = self.LEAGUE_MAP.get(sport.upper())
        if league_id is None:
            logger.warning(f"Unknown PrizePicks league for sport '{sport}'. Defaulting to NBA (7).")
            league_id = 7

        params = {"league_id": league_id, "per_page": 250, "single_stat": True}

        try:
            data = await self._get_with_retry(f"{self.BASE_URL}/projections", params)
        except Exception as e:
            logger.exception("PrizePicks odds fetch failed")
            return {}

        # Build player lookup from 'included'
        players: dict[str, str] = {}
        for item in data.get("included", []):
            if item.get("type") == "new_player":
                players[item["id"]] = item["attributes"].get("name", "Unknown")

        odds_data: dict[str, Any] = {}
        for proj in data.get("data", []):
            try:
                proj_id = proj["id"]
                attrs = proj["attributes"]
                player_id = proj["relationships"]["new_player"]["data"]["id"]
                game_rel = proj["relationships"].get("game", {}).get("data") or {}

                odds_data[proj_id] = {
                    "player": players.get(player_id, "Unknown"),
                    "player_id": player_id,
                    "stat_type": attrs.get("stat_type"),
                    "line": float(attrs.get("line_score", 0)),
                    "odds": attrs.get("odds"),          # decimal odds if provided
                    "game_id": game_rel.get("id"),
                    "description": attrs.get("description", ""),
                    "start_time": attrs.get("start_time"),
                    "is_promo": attrs.get("is_promo", False),
                }
            except (KeyError, TypeError, ValueError) as e:
                logger.debug(f"Skipping malformed projection {proj.get('id')}: {e}")

        return odds_data

    async def place_bet(self, legs: list[dict], stake: float, odds: float) -> str:
        """
        SIMULATED — PrizePicks requires an authenticated session to place entries.
        For production: inject session cookies obtained via browser_cookie3 or
        manual login, then POST to /entries with the leg selection payload.
        """
        mock_id = f"PP_MOCK_{int(time.time())}"
        logger.info(
            f"[SIMULATED] PrizePicks entry | id={mock_id} | "
            f"legs={len(legs)} | stake=${stake:.2f} | odds={odds}"
        )
        return mock_id

    async def check_bet_status(self, bet_id: str) -> dict[str, Any]:
        """SIMULATED — In production, GET /entries/{entry_id} with auth headers."""
        if bet_id.startswith("PP_MOCK_"):
            return {"bet_id": bet_id, "status": "pending", "result": None, "source": "simulated"}
        return {"bet_id": bet_id, "status": "unknown", "result": None}

    async def aclose(self):
        """Close the underlying HTTP client."""
        await self.client.aclose()
