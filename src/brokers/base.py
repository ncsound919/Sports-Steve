from abc import ABC, abstractmethod
from typing import Any


class SportsbookBroker(ABC):
    @abstractmethod
    async def get_odds(self, sport: str, event_ids: list[str]) -> dict[str, Any]:
        """Fetch current odds for given events."""

    @abstractmethod
    async def place_bet(self, legs: list[dict], stake: float, odds: float) -> str:
        """Place a bet (single or parlay) and return a confirmation ID."""

    @abstractmethod
    async def check_bet_status(self, bet_id: str) -> dict[str, Any]:
        """Check if a bet has been settled and return outcome."""
