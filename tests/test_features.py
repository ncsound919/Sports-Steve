"""Tests for circadian factoring, parlay builder, account tracker, and budget manager."""

import pytest
from datetime import datetime, timezone, date, timedelta

# ---------------------------------------------------------------------------
# Circadian factoring
# ---------------------------------------------------------------------------


class TestCircadianFactoring:
    def _make_ctx(
        self,
        utc_hour: int = 15,
        home_tz: float = -5.0,
        away_tz: float = -5.0,
        sport: str = "NBA",
        away_b2b: bool = False,
        home_b2b: bool = False,
    ):
        from src.circadian import GameContext, CircadianFactoring
        ctx = GameContext(
            game_time_utc=datetime(2024, 3, 1, utc_hour, 0, tzinfo=timezone.utc),
            home_team_timezone_offset=home_tz,
            away_team_timezone_offset=away_tz,
            sport=sport,
            away_team_back_to_back=away_b2b,
            home_team_back_to_back=home_b2b,
        )
        return ctx

    def test_optimal_hour_gives_bonus(self):
        from src.circadian import CircadianFactoring
        cf = CircadianFactoring()
        # UTC 20:00 + EST (-5) = 15:00 local → optimal window
        ctx = self._make_ctx(utc_hour=20, home_tz=-5.0)
        adj = cf.compute(ctx)
        assert adj.factor > 0

    def test_late_night_gives_penalty(self):
        from src.circadian import CircadianFactoring
        cf = CircadianFactoring()
        # UTC 04:00 + EST (-5) = 23:00 local → late night penalty
        ctx = self._make_ctx(utc_hour=4, home_tz=-5.0)
        adj = cf.compute(ctx)
        assert adj.factor < 0

    def test_back_to_back_away_penalty(self):
        from src.circadian import CircadianFactoring
        cf = CircadianFactoring()
        ctx = self._make_ctx(utc_hour=20, home_tz=-5.0, away_b2b=True)
        adj = cf.compute(ctx)
        # Even with optimal hour bonus, b2b penalty should reduce factor
        ctx_no_b2b = self._make_ctx(utc_hour=20, home_tz=-5.0, away_b2b=False)
        adj_no_b2b = cf.compute(ctx_no_b2b)
        assert adj.factor < adj_no_b2b.factor

    def test_eastward_travel_penalty(self):
        from src.circadian import CircadianFactoring
        cf = CircadianFactoring()
        # Away from LA (UTC-8) playing in New York (UTC-5): shift = -5 - (-8) = +3h eastward
        ctx = self._make_ctx(utc_hour=20, home_tz=-5.0, away_tz=-8.0)
        adj = cf.compute(ctx)
        ctx_same_tz = self._make_ctx(utc_hour=20, home_tz=-5.0, away_tz=-5.0)
        adj_same = cf.compute(ctx_same_tz)
        assert adj.factor < adj_same.factor

    def test_non_sensitive_sport_no_adjustment(self):
        from src.circadian import CircadianFactoring
        cf = CircadianFactoring()
        ctx = self._make_ctx(sport="GOLF")
        adj = cf.compute(ctx)
        assert adj.factor == 0.0

    def test_apply_scales_edge(self):
        from src.circadian import CircadianAdjustment
        adj = CircadianAdjustment(factor=0.10)
        result = adj.apply(0.06)
        assert abs(result - 0.066) < 1e-9

    def test_apply_floors_at_zero(self):
        from src.circadian import CircadianAdjustment
        adj = CircadianAdjustment(factor=-2.0)
        assert adj.apply(0.06) == 0.0

    def test_reasons_populated(self):
        from src.circadian import CircadianFactoring
        cf = CircadianFactoring()
        ctx = self._make_ctx(utc_hour=4, home_tz=-5.0, away_b2b=True)
        adj = cf.compute(ctx)
        assert len(adj.reasons) >= 2

    def test_home_local_hour(self):
        from src.circadian import GameContext
        ctx = GameContext(
            game_time_utc=datetime(2024, 3, 1, 23, 0, tzinfo=timezone.utc),
            home_team_timezone_offset=-5.0,
        )
        assert ctx.home_local_hour() == 18

    def test_away_travel_shift(self):
        from src.circadian import GameContext
        ctx = GameContext(
            game_time_utc=datetime(2024, 3, 1, 20, 0, tzinfo=timezone.utc),
            home_team_timezone_offset=-5.0,
            away_team_timezone_offset=-8.0,
        )
        assert ctx.away_travel_shift() == 3.0


# ---------------------------------------------------------------------------
# Parlay builder
# ---------------------------------------------------------------------------


class TestParlayBuilder:
    def _make_leg(self, event_id, odds, win_prob, game_time_utc=None):
        from src.optimization.parlay_builder import Leg
        return Leg(
            event_id=event_id,
            selection="TeamA ML",
            odds=odds,
            win_probability=win_prob,
            game_time_utc=game_time_utc,
        )

    def test_single_leg_parlay(self):
        from src.optimization.parlay_builder import ParlayBuilder
        builder = ParlayBuilder(use_circadian=False)
        leg = self._make_leg("E1", odds=2.0, win_prob=0.60)
        parlay = builder.build([leg], sport="NBA", bankroll=1000.0)
        assert parlay.odds == 2.0
        assert parlay.win_probability == 0.60
        # EV = 0.6 * 1.0 - 0.4 = 0.2
        assert abs(parlay.expected_value - 0.2) < 1e-3

    def test_two_leg_parlay_combined_odds(self):
        from src.optimization.parlay_builder import ParlayBuilder
        builder = ParlayBuilder(use_circadian=False)
        legs = [
            self._make_leg("E1", odds=2.0, win_prob=0.60),
            self._make_leg("E2", odds=1.8, win_prob=0.65),
        ]
        parlay = builder.build(legs, sport="NBA", bankroll=1000.0)
        assert abs(parlay.odds - 3.6) < 1e-6
        assert abs(parlay.win_probability - 0.60 * 0.65) < 1e-6

    def test_negative_ev_gives_zero_stake(self):
        from src.optimization.parlay_builder import ParlayBuilder
        builder = ParlayBuilder(use_circadian=False)
        # Very low win probability → negative EV
        leg = self._make_leg("E1", odds=1.5, win_prob=0.30)
        parlay = builder.build([leg], sport="NBA", bankroll=1000.0)
        assert parlay.recommended_stake == 0.0

    def test_stake_capped_at_max_exposure(self):
        from src.optimization.parlay_builder import ParlayBuilder
        builder = ParlayBuilder(use_circadian=False)
        leg = self._make_leg("E1", odds=5.0, win_prob=0.90)
        parlay = builder.build([leg], sport="NBA", bankroll=1000.0, max_exposure_pct=0.10)
        assert parlay.recommended_stake <= 100.0

    def test_build_raises_on_empty_legs(self):
        from src.optimization.parlay_builder import ParlayBuilder
        builder = ParlayBuilder(use_circadian=False)
        with pytest.raises(ValueError):
            builder.build([], sport="NBA")

    def test_circadian_adjustment_applied(self):
        from src.optimization.parlay_builder import ParlayBuilder, Leg
        builder_on = ParlayBuilder(use_circadian=True)
        builder_off = ParlayBuilder(use_circadian=False)
        # Late-night game (local hour 23) should reduce EV
        late_game = datetime(2024, 3, 1, 4, 0, tzinfo=timezone.utc)  # 23:00 EST
        leg = Leg(
            event_id="E1", selection="TeamA ML", odds=2.0, win_probability=0.60,
            game_time_utc=late_game, home_tz_offset=-5.0,
        )
        p_on = builder_on.build([leg], sport="NBA", bankroll=1000.0)
        p_off = builder_off.build([leg], sport="NBA", bankroll=1000.0)
        assert p_on.expected_value <= p_off.expected_value


class TestParlayOptimizer:
    @pytest.mark.asyncio
    async def test_stub_returns_empty_list(self):
        from src.optimization.parlay_builder import ParlayOptimizer
        opt = ParlayOptimizer(risk_profile="aggressive")
        parlays = await opt.generate_optimized_parlays(sports=["NBA"], min_edge=0.05)
        assert parlays == []

    @pytest.mark.asyncio
    async def test_optimizer_with_candidate_legs(self):
        from src.optimization.parlay_builder import ParlayOptimizer, Leg
        legs = [
            Leg(event_id="E1", selection="Team A ML", odds=2.0, win_probability=0.65),
            Leg(event_id="E2", selection="Team B ML", odds=2.2, win_probability=0.60),
        ]
        opt = ParlayOptimizer(
            risk_profile="balanced",
            candidate_legs=legs,
            use_circadian=False,
        )
        # Patch _fetch_legs to return legs for any sport
        async def _fetch(sports):
            return legs
        opt._fetch_legs = _fetch

        parlays = await opt.generate_optimized_parlays(
            sports=["NBA"], min_edge=0.05, bankroll=1000.0
        )
        # At minimum the single-leg parlays with good EV should appear
        assert len(parlays) >= 1
        # Sorted by EV descending
        evs = [p.expected_value for p in parlays]
        assert evs == sorted(evs, reverse=True)

    @pytest.mark.asyncio
    async def test_optimizer_filters_by_min_edge(self):
        from src.optimization.parlay_builder import ParlayOptimizer, Leg
        # Leg with just barely positive EV but below high min_edge threshold
        legs = [
            Leg(event_id="E1", selection="Team A ML", odds=1.5, win_probability=0.55),
        ]
        opt = ParlayOptimizer(candidate_legs=legs, use_circadian=False)

        async def _fetch(sports):
            return legs
        opt._fetch_legs = _fetch

        parlays = await opt.generate_optimized_parlays(
            sports=["NBA"], min_edge=0.90, bankroll=1000.0  # very high threshold
        )
        assert parlays == []

    def test_kelly_fraction_by_profile(self):
        from src.optimization.parlay_builder import ParlayOptimizer
        assert ParlayOptimizer(risk_profile="aggressive")._kelly_fraction == 0.50
        assert ParlayOptimizer(risk_profile="balanced")._kelly_fraction == 0.25
        assert ParlayOptimizer(risk_profile="conservative")._kelly_fraction == 0.10


# ---------------------------------------------------------------------------
# Account tracker
# ---------------------------------------------------------------------------


class TestAccountTracker:
    def setup_method(self):
        from src.account_tracker import AccountTracker
        self.tracker = AccountTracker()

    def test_add_and_retrieve_account(self):
        acc = self.tracker.add_account("DraftKings", initial_balance=500.0)
        assert acc.name == "DraftKings"
        assert acc.balance == 500.0
        retrieved = self.tracker.get_account(acc.account_id)
        assert retrieved is acc

    def test_get_account_by_name(self):
        self.tracker.add_account("FanDuel", initial_balance=200.0)
        acc = self.tracker.get_account_by_name("fanduel")  # case-insensitive
        assert acc is not None
        assert acc.name == "FanDuel"

    def test_total_balance(self):
        self.tracker.add_account("DraftKings", initial_balance=500.0)
        self.tracker.add_account("FanDuel", initial_balance=200.0)
        assert self.tracker.total_balance() == 700.0

    def test_deposit(self):
        acc = self.tracker.add_account("PrizePicks", initial_balance=100.0)
        acc.deposit(50.0)
        assert acc.balance == 150.0

    def test_withdraw(self):
        acc = self.tracker.add_account("DraftKings", initial_balance=200.0)
        acc.withdraw(80.0)
        assert acc.balance == 120.0

    def test_withdraw_insufficient_raises(self):
        from src.account_tracker import SportsbookAccount
        acc = self.tracker.add_account("BetMGM", initial_balance=20.0)
        with pytest.raises(ValueError):
            acc.withdraw(100.0)

    def test_bet_win_updates_balance(self):
        acc = self.tracker.add_account("DraftKings", initial_balance=100.0)
        acc.apply_bet_result(stake=20.0, odds=2.0, result="won")
        assert acc.balance == 120.0  # profit = 20 * (2-1) = 20

    def test_bet_loss_updates_balance(self):
        acc = self.tracker.add_account("FanDuel", initial_balance=100.0)
        acc.apply_bet_result(stake=30.0, odds=2.0, result="lost")
        assert acc.balance == 70.0

    def test_bet_void_no_change(self):
        acc = self.tracker.add_account("DraftKings", initial_balance=100.0)
        acc.apply_bet_result(stake=20.0, odds=2.0, result="void")
        assert acc.balance == 100.0

    def test_account_summary(self):
        acc = self.tracker.add_account("BetMGM", initial_balance=150.0)
        acc.apply_bet_result(stake=25.0, odds=2.5, result="won")
        summary = acc.summary()
        assert summary["name"] == "BetMGM"
        assert summary["balance"] == 187.5
        assert summary["net_betting_pnl"] == 37.5

    def test_health_report_flags_low_balance(self):
        self.tracker.add_account("TinyBook", initial_balance=5.0)
        report = self.tracker.health_report()
        assert any("low_balance" in r["flags"] for r in report)

    def test_health_report_flags_limited(self):
        acc = self.tracker.add_account("BigBook", initial_balance=500.0)
        acc.is_limited = True
        report = self.tracker.health_report()
        assert any("limited" in r["flags"] for r in report)

    def test_remove_account(self):
        acc = self.tracker.add_account("ToRemove", initial_balance=10.0)
        removed = self.tracker.remove_account(acc.account_id)
        assert removed is True
        assert self.tracker.get_account(acc.account_id) is None

    def test_apply_bet_result_unknown_account(self):
        result = self.tracker.apply_bet_result("nonexistent", stake=10.0, odds=2.0, result="won")
        assert result is None

    def test_deposit_negative_raises(self):
        acc = self.tracker.add_account("TestBook", initial_balance=100.0)
        with pytest.raises(ValueError):
            acc.deposit(-10.0)


# ---------------------------------------------------------------------------
# Budget manager
# ---------------------------------------------------------------------------


class TestBudgetManager:
    def setup_method(self):
        from src.budget import BudgetManager, BudgetPeriod
        self.bm = BudgetManager()
        self.BudgetPeriod = BudgetPeriod

    def test_no_budget_always_allows_spend(self):
        assert self.bm.can_spend(1000.0) is True

    def test_add_daily_budget(self):
        budget = self.bm.add_budget(self.BudgetPeriod.DAILY, limit=100.0)
        assert budget.limit == 100.0

    def test_invalid_budget_limit_raises(self):
        with pytest.raises(ValueError):
            self.bm.add_budget(self.BudgetPeriod.DAILY, limit=-10.0)

    def test_can_spend_within_limit(self):
        self.bm.add_budget(self.BudgetPeriod.DAILY, limit=100.0)
        assert self.bm.can_spend(50.0) is True

    def test_cannot_spend_exceeding_limit(self):
        self.bm.add_budget(self.BudgetPeriod.DAILY, limit=100.0)
        self.bm.record_spend("B1", 80.0, sport="NBA", sportsbook="DK")
        assert self.bm.can_spend(30.0) is False

    def test_remaining_after_spend(self):
        self.bm.add_budget(self.BudgetPeriod.DAILY, limit=100.0)
        self.bm.record_spend("B1", 40.0)
        assert self.bm.remaining(self.BudgetPeriod.DAILY) == 60.0

    def test_remaining_floors_at_zero(self):
        self.bm.add_budget(self.BudgetPeriod.DAILY, limit=50.0)
        self.bm.record_spend("B1", 80.0)
        assert self.bm.remaining(self.BudgetPeriod.DAILY) == 0.0

    def test_spent_in_period_filters_by_sport(self):
        self.bm.add_budget(self.BudgetPeriod.DAILY, limit=200.0)
        self.bm.record_spend("B1", 30.0, sport="NBA")
        self.bm.record_spend("B2", 50.0, sport="NFL")
        assert self.bm.spent_in_period(self.BudgetPeriod.DAILY, sport="NBA") == 30.0
        assert self.bm.spent_in_period(self.BudgetPeriod.DAILY, sport="NFL") == 50.0

    def test_sport_sub_limits(self):
        self.bm.add_budget(
            self.BudgetPeriod.DAILY,
            limit=200.0,
            sport_limits={"NBA": 50.0},
        )
        self.bm.record_spend("B1", 40.0, sport="NBA")
        assert self.bm.can_spend(20.0, sport="NBA") is False   # would exceed NBA sub-limit
        assert self.bm.can_spend(20.0, sport="NFL") is True    # NFL uses the global limit

    def test_record_spend_negative_raises(self):
        with pytest.raises(ValueError):
            self.bm.record_spend("B1", -10.0)

    def test_weekly_budget_period_start(self):
        from src.budget import Budget, BudgetPeriod
        budget = Budget(period=BudgetPeriod.WEEKLY, limit=500.0)
        today = date(2024, 3, 6)  # Wednesday
        start = budget.period_start(today)
        assert start.weekday() == 0  # Monday

    def test_monthly_budget_period_start(self):
        from src.budget import Budget, BudgetPeriod
        budget = Budget(period=BudgetPeriod.MONTHLY, limit=2000.0)
        today = date(2024, 3, 15)
        assert budget.period_start(today) == date(2024, 3, 1)

    def test_summary_dict(self):
        self.bm.add_budget(self.BudgetPeriod.DAILY, limit=100.0)
        self.bm.record_spend("B1", 40.0)
        summary = self.bm.summary()
        assert "daily" in summary
        assert summary["daily"]["spent"] == 40.0
        assert summary["daily"]["remaining"] == 60.0
        assert summary["daily"]["utilisation_pct"] == 40.0

    def test_no_budget_remaining_is_inf(self):
        assert self.bm.remaining(self.BudgetPeriod.DAILY) == float("inf")


# ---------------------------------------------------------------------------
# Config — new settings
# ---------------------------------------------------------------------------


class TestConfigNewSettings:
    def test_circadian_enabled_default(self):
        from src.config import Settings
        s = Settings()
        assert s.CIRCADIAN_ENABLED is True

    def test_budget_limits_default_zero(self):
        from src.config import Settings
        s = Settings()
        assert s.BUDGET_DAILY_LIMIT == 0.0
        assert s.BUDGET_WEEKLY_LIMIT == 0.0
        assert s.BUDGET_MONTHLY_LIMIT == 0.0
