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

    Authentication
    --------------
    PrizePicks uses cookie-based session auth, not a Bearer token.
    Pass session_cookie and csrf_token (extracted from a logged-in browser
    session) to enable real bet placement via place_bet().

    Without auth credentials, get_odds() still works (public endpoint)
    but place_bet() falls back to simulation.
    """

    BASE_URL = "https://api.prizepicks.com"

    # PrizePicks league IDs (verify periodically -- these can change)
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
        session_cookie: str | None = None,
        csrf_token: str | None = None,
        # Legacy Bearer token (ignored if session_cookie is provided)
        auth_token: str | None = None,
        max_retries: int = 3,
        retry_delay: float = 2.0,
    ):
        self.session_cookie = session_cookie or ""
        self.csrf_token = csrf_token or ""
        self.max_retries = max_retries
        self.retry_delay = retry_delay

        headers: dict[str, str] = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://app.prizepicks.com/",
            "Accept": "application/json",
        }

        cookies: dict[str, str] = {}

        if self.session_cookie:
            # PrizePicks uses _prizepicks_session as the cookie name
            cookies["_prizepicks_session"] = self.session_cookie
            logger.info("PrizePicksBroker: session cookie loaded (len=%d)", len(self.session_cookie))
        elif auth_token:
            # Fallback: legacy Bearer token
            headers["Authorization"] = f"Bearer {auth_token}"
            logger.info("PrizePicksBroker: using legacy Bearer token")
        else:
            logger.warning(
                "PrizePicksBroker: no auth credentials -- get_odds() will work "
                "but place_bet() will be simulated."
            )

        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token

        self.client = httpx.AsyncClient(headers=headers, cookies=cookies, timeout=15.0)

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
            logger.warning("Unknown PrizePicks league for sport '%s'. Defaulting to NBA (7).", sport)
            league_id = 7

        params = {"league_id": league_id, "per_page": 250, "single_stat": True}

        try:
            data = await self._get_with_retry(f"{self.BASE_URL}/projections", params)
        except Exception:
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
                logger.debug("Skipping malformed projection %s: %s", proj.get("id"), e)

        return odds_data

    async def place_bet(self, legs: list[dict], stake: float, odds: float) -> str:
        """
        Place a real PrizePicks entry if session auth is available,
        otherwise simulate.

        PrizePicks entry payload structure (POST /entries):
          {
            "data": {
              "type": "entry",
              "attributes": { "amount": <stake>, "currency": "USD" },
              "relationships": {
                "slips": {
                  "data": [
                    { "type": "slip", "id": "<projection_id>",
                      "attributes": { "pick": "more"|"less" } },
                    ...
                  ]
                }
              }
            }
          }

        Each leg dict must have: projection_id (str), pick ("more" or "less").
        """
        if stake <= 0:
            raise ValueError(f"Stake must be positive, got {stake}")
        if stake < 5.0:
            raise ValueError(f"Minimum PrizePicks stake is $5, got ${stake:.2f}")
        if stake > 500.0:
            raise ValueError(f"Maximum stake exceeded: ${stake:.2f}")

        if not self.session_cookie:
            mock_id = f"PP_MOCK_{int(time.time())}"
            logger.info(
                "[SIMULATED] PrizePicks entry | id=%s | legs=%d | stake=$%.2f | odds=%s",
                mock_id, len(legs), stake, odds,
            )
            return mock_id

        # Build real payload
        slips = []
        for leg in legs:
            proj_id = leg.get("projection_id") or leg.get("event_id", "")
            pick = leg.get("pick", "more")
            slips.append({
                "type": "slip",
                "id": str(proj_id),
                "attributes": {"pick": pick},
            })

        payload = {
            "data": {
                "type": "entry",
                "attributes": {
                    "amount": round(stake, 2),
                    "currency": "USD",
                },
                "relationships": {
                    "slips": {"data": slips}
                },
            }
        }

        try:
            resp = await self.client.post(
                f"{self.BASE_URL}/entries",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            entry_id = data.get("data", {}).get("id", f"PP_UNKNOWN_{int(time.time())}")
            logger.info(
                "PrizePicks entry placed | id=%s | legs=%d | stake=$%.2f",
                entry_id, len(legs), stake,
            )
            return str(entry_id)
        except httpx.HTTPStatusError as e:
            logger.error("PrizePicks API error: status=%s", e.response.status_code)
            raise
        except Exception:
            logger.exception("PrizePicks place_bet unexpected error")
            raise

    async def check_bet_status(self, bet_id: str) -> dict[str, Any]:
        """
        Check the status of an entry.
        For simulated bets (PP_MOCK_*), always returns pending.
        For real entry IDs, polls GET /entries/{entry_id}.
        """
        if bet_id.startswith("PP_MOCK_"):
            return {"bet_id": bet_id, "status": "pending", "result": None, "source": "simulated"}

        if not self.session_cookie:
            return {"bet_id": bet_id, "status": "unknown", "result": None}

        try:
            resp = await self.client.get(f"{self.BASE_URL}/entries/{bet_id}")
            resp.raise_for_status()
            data = resp.json().get("data", {})
            attrs = data.get("attributes", {})
            state = attrs.get("status", "unknown")

            # Map PrizePicks entry states to our internal states
            status_map = {
                "won": "settled",
                "lost": "settled",
                "pending": "pending",
                "void": "settled",
            }
            internal_status = status_map.get(state, "pending")
            result = state if state in ("won", "lost", "void") else None

            return {
                "bet_id": bet_id,
                "status": internal_status,
                "result": result,
                "raw_status": state,
                "source": "prizepicks_api",
            }
        except Exception:
            logger.exception("PrizePicks check_bet_status failed for %s", bet_id)
            return {"bet_id": bet_id, "status": "unknown", "result": None}

    async def aclose(self):
        """Close the underlying HTTP client."""
        await self.client.aclose()