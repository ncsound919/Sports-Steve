"""
src/budget.py — Betting budget management for Sports-Steve.

Implements:
  - BudgetPeriod: configurable daily / weekly / monthly spend limits
  - BudgetManager: tracks spend, enforces limits, and provides reporting
  - Integration hook for RiskManager (check budget before placing a bet)
"""

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timezone, timedelta
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class BudgetPeriod(str, Enum):
    """Granularity of a budget cycle."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class BudgetEntry:
    """A single spending record against a budget."""

    bet_id: str
    amount: float
    sport: str
    sportsbook: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class Budget:
    """
    A budget constraint for a given period.

    Parameters
    ----------
    period:
        Granularity — daily, weekly, or monthly.
    limit:
        Maximum amount (USD) allowed to be staked in one period.
    sport_limits:
        Optional per-sport sub-limits (e.g. {"NBA": 50.0}).
    """

    period: BudgetPeriod
    limit: float
    sport_limits: dict[str, float] = field(default_factory=dict)

    def period_start(self, reference: date | None = None) -> date:
        """Return the start date of the current budget period."""
        ref = reference or date.today()
        if self.period == BudgetPeriod.DAILY:
            return ref
        if self.period == BudgetPeriod.WEEKLY:
            # Monday of the current week
            return ref - timedelta(days=ref.weekday())
        # Monthly
        return ref.replace(day=1)

    def period_end(self, reference: date | None = None) -> date:
        """Return the last date of the current budget period (inclusive)."""
        start = self.period_start(reference)
        if self.period == BudgetPeriod.DAILY:
            return start
        if self.period == BudgetPeriod.WEEKLY:
            return start + timedelta(days=6)
        # Monthly
        # Move to first day of next month, then subtract one day
        if start.month == 12:
            next_month = start.replace(year=start.year + 1, month=1, day=1)
        else:
            next_month = start.replace(month=start.month + 1, day=1)
        return next_month - timedelta(days=1)


# ---------------------------------------------------------------------------
# Budget manager
# ---------------------------------------------------------------------------


class BudgetManager:
    """
    Tracks betting expenditure against one or more budget constraints.

    Usage
    -----
    >>> bm = BudgetManager()
    >>> bm.add_budget(BudgetPeriod.DAILY, limit=100.0)
    >>> bm.add_budget(BudgetPeriod.WEEKLY, limit=500.0)
    >>> bm.can_spend(50.0)
    True
    >>> bm.record_spend("BET_1", 50.0, sport="NBA", sportsbook="DraftKings")
    >>> bm.remaining(BudgetPeriod.DAILY)
    50.0
    """

    def __init__(self):
        self._budgets: dict[BudgetPeriod, Budget] = {}
        self._entries: list[BudgetEntry] = []
        logger.info("BudgetManager initialized.")

    # ------------------------------------------------------------------
    # Budget configuration
    # ------------------------------------------------------------------

    def add_budget(
        self,
        period: BudgetPeriod,
        limit: float,
        sport_limits: dict[str, float] | None = None,
    ) -> Budget:
        """
        Add or replace a budget constraint for a period.

        Parameters
        ----------
        period:
            Granularity of the budget cycle.
        limit:
            Maximum total stake allowed per period.
        sport_limits:
            Optional per-sport sub-limits.
        """
        if limit <= 0:
            raise ValueError(f"Budget limit must be positive, got {limit}")
        budget = Budget(
            period=period,
            limit=limit,
            sport_limits=sport_limits or {},
        )
        self._budgets[period] = budget
        logger.info("Budget set: %s limit=%.2f sport_limits=%s", period.value, limit, budget.sport_limits)
        return budget

    def get_budget(self, period: BudgetPeriod) -> Budget | None:
        """Return the budget for a period, or None if not set."""
        return self._budgets.get(period)

    # ------------------------------------------------------------------
    # Spend tracking
    # ------------------------------------------------------------------

    def record_spend(
        self,
        bet_id: str,
        amount: float,
        sport: str = "unknown",
        sportsbook: str = "unknown",
        timestamp: datetime | None = None,
    ) -> BudgetEntry:
        """
        Record a bet stake against all active budgets.

        Parameters
        ----------
        bet_id:
            Unique identifier for the bet (broker confirmation ID).
        amount:
            Stake amount (positive).
        sport:
            Sport the bet relates to.
        sportsbook:
            Sportsbook the bet was placed on.
        timestamp:
            Override the entry timestamp (defaults to now).
        """
        if amount <= 0:
            raise ValueError(f"Spend amount must be positive, got {amount}")
        entry = BudgetEntry(
            bet_id=bet_id,
            amount=amount,
            sport=sport,
            sportsbook=sportsbook,
        )
        if timestamp is not None:
            entry.timestamp = timestamp
        self._entries.append(entry)
        logger.info(
            "Budget spend recorded: bet_id=%s amount=%.2f sport=%s sportsbook=%s",
            bet_id, amount, sport, sportsbook,
        )
        return entry

    def spent_in_period(
        self,
        period: BudgetPeriod,
        sport: str | None = None,
        reference: date | None = None,
    ) -> float:
        """
        Return total amount spent within the current period.

        Parameters
        ----------
        period:
            Which budget period to query.
        sport:
            If provided, only sum entries for this sport.
        reference:
            Date to use as "today" (defaults to today).
        """
        budget = self._budgets.get(period)
        if budget is None:
            return 0.0

        ref = reference or date.today()
        start = budget.period_start(ref)
        end = budget.period_end(ref)

        total = 0.0
        for entry in self._entries:
            entry_date = entry.timestamp.date()
            if start <= entry_date <= end:
                if sport is None or entry.sport.upper() == sport.upper():
                    total += entry.amount
        return round(total, 2)

    def remaining(
        self,
        period: BudgetPeriod,
        sport: str | None = None,
        reference: date | None = None,
    ) -> float:
        """Return remaining budget for a period (floor of 0)."""
        budget = self._budgets.get(period)
        if budget is None:
            return float("inf")

        if sport and sport.upper() in {k.upper() for k in budget.sport_limits}:
            sport_key = next(k for k in budget.sport_limits if k.upper() == sport.upper())
            limit = budget.sport_limits[sport_key]
        else:
            limit = budget.limit

        spent = self.spent_in_period(period, sport=sport, reference=reference)
        return round(max(0.0, limit - spent), 2)

    # ------------------------------------------------------------------
    # Gating
    # ------------------------------------------------------------------

    def can_spend(
        self,
        amount: float,
        sport: str | None = None,
        reference: date | None = None,
    ) -> bool:
        """
        Return True if *amount* can be spent without breaching any budget.

        Checks all registered budget periods. If no budgets are set, always
        returns True (unbudgeted).
        """
        if not self._budgets:
            return True
        for period in self._budgets:
            if self.remaining(period, sport=sport, reference=reference) < amount:
                logger.warning(
                    "Budget breach: %s remaining=%.2f requested=%.2f sport=%s",
                    period.value,
                    self.remaining(period, sport=sport, reference=reference),
                    amount,
                    sport,
                )
                return False
        return True

    # ------------------------------------------------------------------
    # Reporting
    # ------------------------------------------------------------------

    def summary(self, reference: date | None = None) -> dict[str, Any]:
        """Return a summary dict of all budgets for the current period."""
        ref = reference or date.today()
        result: dict[str, Any] = {}
        for period, budget in self._budgets.items():
            spent = self.spent_in_period(period, reference=ref)
            result[period.value] = {
                "limit": budget.limit,
                "spent": spent,
                "remaining": round(max(0.0, budget.limit - spent), 2),
                "utilisation_pct": round(spent / budget.limit * 100, 1) if budget.limit > 0 else 0.0,
                "period_start": budget.period_start(ref).isoformat(),
                "period_end": budget.period_end(ref).isoformat(),
                "sport_limits": budget.sport_limits,
            }
        return result
