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


# ---------------------------------------------------------------------------
# RiskManager — bankroll management, stop-loss, exposure, audit trail
# ---------------------------------------------------------------------------


class TestRiskManagerKelly:
    """Tests for Kelly criterion stake sizing."""

    def setup_method(self):
        from src.risk_manager import RiskManager
        self.rm = RiskManager(bankroll=1_000.0, kelly_fraction=0.25, max_exposure_pct=0.20)

    def test_positive_edge_returns_positive_stake(self):
        stake = self.rm.kelly_stake(win_probability=0.55, decimal_odds=2.0)
        assert stake > 0

    def test_negative_edge_returns_zero(self):
        # p=0.40, odds=2.0 → kelly = (1*0.4 - 0.6)/1 = -0.2 → negative
        stake = self.rm.kelly_stake(win_probability=0.40, decimal_odds=2.0)
        assert stake == 0.0

    def test_stake_capped_at_max_exposure(self):
        # Even with very high edge, stake should not exceed 20% of bankroll
        stake = self.rm.kelly_stake(win_probability=0.99, decimal_odds=10.0)
        assert stake <= 1_000.0 * 0.20

    def test_invalid_probability_returns_zero(self):
        assert self.rm.kelly_stake(win_probability=0.0, decimal_odds=2.0) == 0.0
        assert self.rm.kelly_stake(win_probability=1.0, decimal_odds=2.0) == 0.0

    def test_odds_at_or_below_one_returns_zero(self):
        assert self.rm.kelly_stake(win_probability=0.6, decimal_odds=1.0) == 0.0
        assert self.rm.kelly_stake(win_probability=0.6, decimal_odds=0.5) == 0.0


class TestRiskManagerStopLoss:
    """Tests for stop-loss and cool-down logic."""

    def setup_method(self):
        from src.risk_manager import RiskManager
        self.rm = RiskManager(bankroll=1_000.0, max_daily_loss_pct=0.10)

    def test_no_stop_loss_initially(self):
        assert self.rm.check_stop_loss() is False

    def test_stop_loss_triggered_after_loss(self):
        self.rm._daily_pnl = -200.0   # exceeds 10% of 1000
        assert self.rm.check_stop_loss() is True
        assert self.rm._is_cooling_down is True

    def test_cool_down_prevents_further_bets(self):
        self.rm._is_cooling_down = True
        assert self.rm.check_stop_loss() is True

    def test_reset_clears_cool_down_and_pnl(self):
        self.rm._daily_pnl = -200.0
        self.rm.check_stop_loss()
        self.rm.reset_daily_limits()
        assert self.rm._is_cooling_down is False
        assert self.rm._daily_pnl == 0.0
        assert self.rm.check_stop_loss() is False


class TestRiskManagerExposure:
    """Tests for exposure monitoring."""

    def setup_method(self):
        from src.risk_manager import RiskManager
        from src.risk_manager import Bet
        from datetime import datetime, timezone
        self.rm = RiskManager(bankroll=1_000.0)
        self.Bet = Bet

    def test_no_exposure_initially(self):
        exposure = self.rm.get_exposure()
        assert exposure["total_open_stake"] == 0.0
        assert exposure["open_bet_count"] == 0

    def test_exposure_reflects_pending_bets(self):
        from datetime import datetime, timezone
        bet = self.Bet(
            id="b1", bet_id="DK_1", broker_name="draftkings",
            sport="NFL", legs=[], stake=50.0, odds=2.5,
            expected_value=0.1,
        )
        self.rm._bets["b1"] = bet
        exposure = self.rm.get_exposure()
        assert exposure["total_open_stake"] == 50.0
        assert exposure["by_broker"]["draftkings"] == 50.0
        assert exposure["by_sport"]["NFL"] == 50.0
        assert exposure["exposure_pct"] == 5.0

    def test_settled_bets_excluded_from_exposure(self):
        from datetime import datetime, timezone
        bet = self.Bet(
            id="b2", bet_id="DK_2", broker_name="draftkings",
            sport="NBA", legs=[], stake=100.0, odds=3.0,
            expected_value=0.2, status="won",
        )
        self.rm._bets["b2"] = bet
        exposure = self.rm.get_exposure()
        assert exposure["total_open_stake"] == 0.0

    def test_exposure_with_zero_bankroll(self):
        # Simulate a scenario where the bankroll is depleted to zero.
        from datetime import datetime, timezone
        self.rm.bankroll = 0.0
        bet = self.Bet(
            id="b3", bet_id="DK_3", broker_name="draftkings",
            sport="NFL", legs=[], stake=50.0, odds=2.0,
            expected_value=0.05,
        )
        self.rm._bets["b3"] = bet
        exposure = self.rm.get_exposure()
        assert exposure["total_open_stake"] == 50.0
        # When bankroll is zero, the implementation uses a conditional to avoid
        # division by zero. Verify that this path results in a finite exposure_pct.
        assert exposure["exposure_pct"] == 0.0

    def test_exposure_with_negative_bankroll(self):
        # Simulate a scenario where the bankroll has gone negative after losses.
        from datetime import datetime, timezone
        self.rm.bankroll = -100.0
        bet = self.Bet(
            id="b4", bet_id="DK_4", broker_name="draftkings",
            sport="NBA", legs=[], stake=75.0, odds=2.5,
            expected_value=0.08,
        )
        self.rm._bets["b4"] = bet
        exposure = self.rm.get_exposure()
        assert exposure["total_open_stake"] == 75.0
        # For non-positive bankroll, the conditional path should again avoid
        # invalid percentages and keep exposure_pct at a safe default.
        assert exposure["exposure_pct"] == 0.0
class TestRiskManagerAuditTrail:
    """Tests for bet recording and settlement."""

    def setup_method(self):
        from src.risk_manager import RiskManager
        self.rm = RiskManager(bankroll=1_000.0)

    @pytest.mark.asyncio
    async def test_record_bet_stores_bet(self):
        from src.optimization.parlay_builder import Parlay, Leg
        parlay = Parlay(id="p1", sport="NBA", odds=2.0, recommended_stake=50.0, expected_value=0.1)
        bet = await self.rm.record_bet(parlay, "DK_MOCK_1", "draftkings")
        assert bet.bet_id == "DK_MOCK_1"
        assert bet.status == "pending"
        pending = await self.rm.get_pending_bets()
        assert len(pending) == 1

    @pytest.mark.asyncio
    async def test_settle_bet_won_updates_bankroll(self):
        from src.optimization.parlay_builder import Parlay
        parlay = Parlay(id="p2", sport="NFL", odds=2.0, recommended_stake=100.0)
        bet = await self.rm.record_bet(parlay, "DK_MOCK_2", "draftkings")
        settled = await self.rm.settle_bet(bet.id, "won")
        assert settled.status == "won"
        assert self.rm.bankroll == 1_100.0   # won 100 * (2.0 - 1) = 100

    @pytest.mark.asyncio
    async def test_settle_bet_lost_updates_bankroll(self):
        from src.optimization.parlay_builder import Parlay
        parlay = Parlay(id="p3", sport="NHL", odds=3.0, recommended_stake=100.0)
        bet = await self.rm.record_bet(parlay, "DK_MOCK_3", "draftkings")
        settled = await self.rm.settle_bet(bet.id, "lost")
        assert settled.status == "lost"
        assert self.rm.bankroll == 900.0

    @pytest.mark.asyncio
    async def test_settle_unknown_bet_returns_none(self):
        result = await self.rm.settle_bet("nonexistent-id", "won")
        assert result is None

    @pytest.mark.asyncio
    async def test_pending_bets_excludes_settled(self):
        from src.optimization.parlay_builder import Parlay
        parlay = Parlay(id="p4", sport="MLB", odds=2.5, recommended_stake=40.0)
        bet = await self.rm.record_bet(parlay, "PP_MOCK_4", "prizepicks")
        await self.rm.settle_bet(bet.id, "lost")
        pending = await self.rm.get_pending_bets()
        assert all(b.status == "pending" for b in pending)
