"""Tests for the sportsbook broker implementations."""

import time
import pytest
import pytest_asyncio

from src.brokers.base import SportsbookBroker
from src.brokers.prizepicks import PrizePicksBroker


# ---------------------------------------------------------------------------
# SportsbookBroker ABC
# ---------------------------------------------------------------------------


class TestSportsbookBrokerABC:
    """Verify the abstract base class cannot be instantiated directly."""

    def test_cannot_instantiate_abc(self):
        with pytest.raises(TypeError):
            SportsbookBroker()


# ---------------------------------------------------------------------------
# PrizePicksBroker (no external deps required)
# ---------------------------------------------------------------------------


class TestPrizePicksBroker:
    """Unit tests for PrizePicksBroker using simulated (mock) paths."""

    @pytest_asyncio.fixture
    async def broker(self):
        pp = PrizePicksBroker(auth_token=None)
        yield pp
        await pp.aclose()

    @pytest.mark.asyncio
    async def test_place_bet_returns_mock_id(self, broker):
        bet_id = await broker.place_bet(
            legs=[{"player": "LeBron James", "stat": "Points", "line": 25.5}],
            stake=10.0,
            odds=2.5,
        )
        assert bet_id.startswith("PP_MOCK_")

    @pytest.mark.asyncio
    async def test_check_bet_status_mock(self, broker):
        mock_id = f"PP_MOCK_{int(time.time())}"
        status = await broker.check_bet_status(mock_id)
        assert status["bet_id"] == mock_id
        assert status["status"] == "pending"
        assert status["source"] == "simulated"

    @pytest.mark.asyncio
    async def test_check_bet_status_unknown(self, broker):
        status = await broker.check_bet_status("SOME_REAL_ID_123")
        assert status["status"] == "unknown"

    def test_league_map_has_expected_sports(self, broker):
        expected = {"NBA", "NFL", "NHL", "MLB"}
        assert expected.issubset(set(broker.LEAGUE_MAP.keys()))


# ---------------------------------------------------------------------------
# Scheduler helpers (no APScheduler needed)
# ---------------------------------------------------------------------------


class TestSchedulerHelpers:
    def test_validate_edge_truthy(self):
        from src.scheduler import validate_edge
        assert validate_edge(None, {"some": "odds"}) is True

    def test_validate_edge_empty(self):
        from src.scheduler import validate_edge
        assert validate_edge(None, {}) is False

    def test_select_broker_game_line_sport(self):
        from src.scheduler import _select_broker
        # Build a fake brokers dict
        brokers = {"draftkings": "dk_broker", "prizepicks": "pp_broker"}
        name, broker = _select_broker(brokers, "NFL")
        assert name == "draftkings"
        assert broker == "dk_broker"

    def test_select_broker_prop_sport(self):
        from src.scheduler import _select_broker
        brokers = {"draftkings": "dk_broker", "prizepicks": "pp_broker"}
        name, broker = _select_broker(brokers, "GOLF")
        assert name == "prizepicks"
        assert broker == "pp_broker"


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


class TestConfig:
    def test_default_settings(self):
        from src.config import Settings
        s = Settings()
        assert isinstance(s.ACTIVE_SPORTS, list)
        assert s.MIN_EDGE == 0.05
        assert s.MAX_DAILY_STAKE == 100.0


# ---------------------------------------------------------------------------
# Parlay builder stub
# ---------------------------------------------------------------------------


class TestParlayOptimizer:
    @pytest.mark.asyncio
    async def test_stub_returns_empty_list(self):
        from src.optimization.parlay_builder import ParlayOptimizer
        opt = ParlayOptimizer(risk_profile="aggressive")
        parlays = await opt.generate_optimized_parlays(sports=["NBA"], min_edge=0.05)
        assert parlays == []
