"""
src/brokers/oddsapi.py

The Odds API broker — fetches live odds from multiple sportsbooks via
https://the-odds-api.com/

This is a READ-ONLY data source (The Odds API does not place bets).
place_bet() returns a simulated confirmation ID.
check_bet_status() returns "pending" for simulated bets.

API docs: https://the-odds-api.com/liveapi/guides/v4/
"""

import time
import logging
import asyncio
from typing import Any, ClassVar

import httpx

from .base import SportsbookBroker
from src.config import settings

logger = logging.getLogger(__name__)

_HTTP_TOO_MANY_REQUESTS = 429


class OddsApiBroker(SportsbookBroker):
    """
    Broker for The Odds API — multi-book odds aggregation.

    Provides game lines (moneyline, spread, totals) and player props
    from 40+ sportsbooks including DraftKings, FanDuel, BetMGM, etc.

    This gives us cross-book comparison for finding value / line shopping.
    """

    BASE_URL = "https://api.the-odds-api.com/v4"

    # Map internal sport names to The Odds API sport keys
    SPORT_MAP: ClassVar[dict[str, str]] = {
        "NBA": "basketball_nba",
        "NFL": "americanfootball_nfl",
        "MLB": "baseball_mlb",
        "NHL": "icehockey_nhl",
        "WNBA": "basketball_wnba",
        "NCAAFB": "americanfootball_ncaaf",
        "NCAAMB": "basketball_ncaab",
        "CFB": "americanfootball_ncaaf",
        "CBB": "basketball_ncaab",
        "MLS": "soccer_usa_mls",
        "EPL": "soccer_epl",
        "UFC": "mma_mixed_martial_arts",
        "MMA": "mma_mixed_martial_arts",
        "SOCCER": "soccer_usa_mls",
    }

    # Markets we request from the API
    MARKETS = "h2h,spreads,totals"

    def __init__(
        self,
        api_key: str | None = None,
        regions: str = "us",
        odds_format: str = "american",
        max_retries: int = 3,
        retry_delay: float = 2.0,
    ):
        self.api_key = api_key or settings.THE_ODDS_API_KEY
        if not self.api_key:
            raise ValueError(
                "OddsApiBroker requires THE_ODDS_API_KEY — "
                "set it in .env or pass api_key= directly."
            )

        self.regions = regions
        self.odds_format = odds_format
        self.max_retries = max_retries
        self.retry_delay = retry_delay

        # Track API usage (The Odds API returns remaining quota in headers)
        self.requests_remaining: int | None = None
        self.requests_used: int | None = None

        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": "Sports-Steve/1.0",
                "Accept": "application/json",
            },
            timeout=15.0,
        )

    async def __aenter__(self) -> "OddsApiBroker":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.aclose()

    # ─── Internal Helpers ─────────────────────────────────────────────────

    def _update_quota(self, headers: httpx.Headers) -> None:
        """Track API quota from response headers."""
        remaining = headers.get("x-requests-remaining")
        used = headers.get("x-requests-used")
        if remaining is not None:
            self.requests_remaining = int(remaining)
        if used is not None:
            self.requests_used = int(used)
        if self.requests_remaining is not None:
            logger.debug(
                "Odds API quota: %d remaining, %d used",
                self.requests_remaining,
                self.requests_used or 0,
            )

    async def _get_with_retry(
        self, url: str, params: dict
    ) -> tuple[dict | list, httpx.Headers]:
        """GET with exponential-backoff retry on rate-limit (429) or server errors."""
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = await self.client.get(url, params=params)

                if resp.status_code == _HTTP_TOO_MANY_REQUESTS:
                    wait = self.retry_delay * attempt
                    logger.warning("Odds API rate-limited. Retrying in %.1fs...", wait)
                    await asyncio.sleep(wait)
                    continue

                resp.raise_for_status()
                self._update_quota(resp.headers)
                return resp.json(), resp.headers

            except httpx.HTTPStatusError:
                logger.exception("Odds API HTTP error (attempt %s)", attempt)
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(self.retry_delay * attempt)

            except httpx.RequestError:
                logger.exception("Odds API request error (attempt %s)", attempt)
                if attempt == self.max_retries:
                    raise
                await asyncio.sleep(self.retry_delay * attempt)

        return [], httpx.Headers()

    def _resolve_sport_key(self, sport: str) -> str | None:
        """Map a human sport name to The Odds API sport key."""
        key = self.SPORT_MAP.get(sport.upper())
        if key is None:
            logger.warning(
                "Unknown Odds API sport mapping for '%s'. Available: %s",
                sport,
                ", ".join(sorted(self.SPORT_MAP.keys())),
            )
        return key

    # ─── SportsbookBroker Interface ───────────────────────────────────────

    async def get_odds(self, sport: str, _event_ids: list[str]) -> dict[str, Any]:
        """
        Fetch odds for a sport across multiple sportsbooks.

        Returns: {
            event_id: {
                home_team, away_team, commence_time, sport,
                bookmakers: [
                    { key, title, markets: [
                        { key, outcomes: [ { name, price, point? } ] }
                    ]}
                ],
                best_odds: { home: { price, book }, away: { price, book } }
            }
        }

        _event_ids is accepted for interface compatibility but unused —
        The Odds API returns all events for a sport in one call.
        """
        sport_key = self._resolve_sport_key(sport)
        if sport_key is None:
            logger.warning(
                "No Odds API mapping for sport '%s', returning empty.", sport
            )
            return {}

        params = {
            "apiKey": self.api_key,
            "regions": self.regions,
            "markets": self.MARKETS,
            "oddsFormat": self.odds_format,
        }

        try:
            data, _headers = await self._get_with_retry(
                f"{self.BASE_URL}/sports/{sport_key}/odds",
                params,
            )
        except Exception:
            logger.exception("Odds API fetch failed for sport=%s", sport)
            return {}

        if not isinstance(data, list):
            logger.error(
                "Odds API returned non-list for sport=%s: %s", sport, type(data)
            )
            return {}

        odds_data: dict[str, Any] = {}

        for event in data:
            event_id = event.get("id", "")
            home = event.get("home_team", "")
            away = event.get("away_team", "")
            commence = event.get("commence_time", "")
            bookmakers = event.get("bookmakers", [])

            # Find best moneyline odds across books
            best_home: dict[str, Any] = {"price": None, "book": None}
            best_away: dict[str, Any] = {"price": None, "book": None}

            for book in bookmakers:
                for market in book.get("markets", []):
                    if market.get("key") != "h2h":
                        continue
                    for outcome in market.get("outcomes", []):
                        name = outcome.get("name", "")
                        price = outcome.get("price", 0)
                        if name == home:
                            if best_home["price"] is None or price > best_home["price"]:
                                best_home = {
                                    "price": price,
                                    "book": book.get("title", ""),
                                }
                        elif name == away:
                            if best_away["price"] is None or price > best_away["price"]:
                                best_away = {
                                    "price": price,
                                    "book": book.get("title", ""),
                                }

            odds_data[event_id] = {
                "home_team": home,
                "away_team": away,
                "commence_time": commence,
                "sport": sport,
                "sport_key": sport_key,
                "bookmakers": bookmakers,
                "best_odds": {
                    "home": best_home,
                    "away": best_away,
                },
            }

        logger.info(
            "Odds API: fetched %d events for %s (%s). Quota remaining: %s",
            len(odds_data),
            sport,
            sport_key,
            self.requests_remaining,
        )

        return odds_data

    async def place_bet(self, legs: list[dict], stake: float, odds: float) -> str:
        """
        Simulated bet placement — The Odds API is read-only.

        Returns a mock confirmation ID. Actual bet placement should go
        through a platform-specific broker (DraftKings, PrizePicks, etc.)
        after using Odds API data for line shopping.
        """
        mock_id = f"ODDS_API_SIM_{int(time.time())}"
        logger.info(
            "[SIMULATED] Odds API bet | id=%s | legs=%d | stake=$%.2f | odds=%s | "
            "Note: The Odds API is read-only. Use a platform broker for real bets.",
            mock_id,
            len(legs),
            stake,
            odds,
        )
        return mock_id

    async def check_bet_status(self, bet_id: str) -> dict[str, Any]:
        """
        Check status of a simulated bet — always returns pending.
        """
        if bet_id.startswith("ODDS_API_SIM_"):
            return {
                "bet_id": bet_id,
                "status": "pending",
                "result": None,
                "source": "simulated",
            }
        return {"bet_id": bet_id, "status": "unknown", "result": None}

    # ─── Extended API Methods ─────────────────────────────────────────────
    # These go beyond the SportsbookBroker ABC for richer data.

    async def get_sports(self) -> list[dict[str, Any]]:
        """
        List all available sports from The Odds API.
        Useful for discovering sport keys and checking which are in-season.
        """
        params = {"apiKey": self.api_key, "all": "false"}

        try:
            data, _headers = await self._get_with_retry(
                f"{self.BASE_URL}/sports",
                params,
            )
        except Exception:
            logger.exception("Odds API get_sports failed")
            return []

        if not isinstance(data, list):
            return []

        return [
            {
                "key": s.get("key", ""),
                "group": s.get("group", ""),
                "title": s.get("title", ""),
                "description": s.get("description", ""),
                "active": s.get("active", False),
                "has_outrights": s.get("has_outrights", False),
            }
            for s in data
        ]

    async def get_scores(self, sport: str, days_from: int = 1) -> list[dict[str, Any]]:
        """
        Fetch recent scores for a sport (completed and in-progress games).
        Useful for settling bets and tracking live games.
        """
        sport_key = self._resolve_sport_key(sport)
        if sport_key is None:
            return []

        params = {
            "apiKey": self.api_key,
            "daysFrom": days_from,
        }

        try:
            data, _headers = await self._get_with_retry(
                f"{self.BASE_URL}/sports/{sport_key}/scores",
                params,
            )
        except Exception:
            logger.exception("Odds API get_scores failed for sport=%s", sport)
            return []

        if not isinstance(data, list):
            return []

        return [
            {
                "id": g.get("id", ""),
                "sport_key": g.get("sport_key", ""),
                "sport_title": g.get("sport_title", ""),
                "commence_time": g.get("commence_time", ""),
                "completed": g.get("completed", False),
                "home_team": g.get("home_team", ""),
                "away_team": g.get("away_team", ""),
                "scores": g.get("scores"),
                "last_update": g.get("last_update"),
            }
            for g in data
        ]

    async def get_event_odds(self, sport: str, event_id: str) -> dict[str, Any] | None:
        """
        Fetch odds for a single event by ID.
        More efficient than fetching all events when you only need one.
        """
        sport_key = self._resolve_sport_key(sport)
        if sport_key is None:
            return None

        params = {
            "apiKey": self.api_key,
            "regions": self.regions,
            "markets": self.MARKETS,
            "oddsFormat": self.odds_format,
        }

        try:
            data, _headers = await self._get_with_retry(
                f"{self.BASE_URL}/sports/{sport_key}/events/{event_id}/odds",
                params,
            )
        except Exception:
            logger.exception("Odds API get_event_odds failed for event=%s", event_id)
            return None

        if not isinstance(data, dict):
            return None

        return data

    async def get_quota(self) -> dict[str, int | None]:
        """Return the current API usage quota."""
        return {
            "requests_remaining": self.requests_remaining,
            "requests_used": self.requests_used,
        }

    async def health_check(self) -> bool:
        """Verify connectivity to The Odds API."""
        try:
            sports = await self.get_sports()
            return len(sports) > 0
        except Exception:
            return False

    async def aclose(self) -> None:
        """Close the underlying HTTP client."""
        await self.client.aclose()
