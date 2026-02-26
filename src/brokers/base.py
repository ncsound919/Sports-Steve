from abc import ABC, abstractmethod
from typing import List, Dict, Any


class SportsbookBroker(ABC):
    @abstractmethod
    async def get_odds(self, sport: str, event_ids: List[str]) -> Dict[str, Any]:
        """Fetch current odds for given events"""
        pass

    @abstractmethod
    async def place_bet(self, legs: List[Dict], stake: float, odds: float) -> str:
        """Place a bet (single or parlay) and return a confirmation ID"""
        pass

    @abstractmethod
    async def check_bet_status(self, bet_id: str) -> Dict[str, Any]:
        """Check if a bet has been settled and return outcome"""
        pass
