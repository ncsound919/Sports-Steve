"""
src/risk_manager.py — Risk management for Sports-Steve.

Implements skills from the Big skills document:
  - Bankroll management algorithms (Kelly criterion, unit sizing)
  - Exposure monitoring and correlation risk assessment
  - Automated stop-losses and cool-down triggers
  - Audit trails and reporting for tax/legal requirements
"""

import asyncio
import json
import logging
import sqlite3
import uuid
from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import datetime, timezone

from src.config import settings
from src.optimization.parlay_builder import Parlay

logger = logging.getLogger(__name__)


@dataclass
class Bet:
    """Record of a single placed bet."""

    id: str
    bet_id: str                   # broker-assigned confirmation ID
    broker_name: str
    sport: str
    legs: list[dict]
    stake: float
    odds: float
    expected_value: float
    status: str = "pending"       # pending | won | lost | void
    result: str | None = None
    placed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    settled_at: datetime | None = None


class RiskManager:
    """
    Central risk management hub.

    Responsibilities
    ----------------
    * Kelly criterion stake sizing (bankroll management)
    * Daily stop-loss enforcement and cool-down triggers
    * Cross-broker exposure monitoring
    * SQLite-backed audit trail for durable persistence
    """

    def __init__(
        self,
        bankroll: float = 1_000.0,
        max_daily_loss_pct: float = 0.10,
        max_exposure_pct: float = 0.20,
        kelly_fraction: float = 0.25,   # fractional Kelly for safety
        db_conn: sqlite3.Connection | None = None,
    ):
        self.bankroll = bankroll
        self.max_daily_loss_pct = max_daily_loss_pct
        self.max_exposure_pct = max_exposure_pct
        self.kelly_fraction = kelly_fraction
        self._db = db_conn

        self._bets: dict[str, Bet] = {}          # id -> Bet
        self._daily_pnl: float = 0.0
        self._is_cooling_down: bool = False
        # Asyncio lock guards state mutations when concurrent coroutines
        # (e.g., BackgroundTasks + APScheduler jobs) run in the same event loop.
        self._lock = asyncio.Lock()

        # Restore state from database if available
        if self._db is not None:
            self._load_from_db()

        logger.info(
            "RiskManager initialized | bankroll=%.2f | "
            "max_daily_loss_pct=%.0f%% | kelly_fraction=%.2f | bets_loaded=%d",
            self.bankroll,
            max_daily_loss_pct * 100,
            kelly_fraction,
            len(self._bets),
        )

    # ------------------------------------------------------------------
    # SQLite persistence helpers
    # ------------------------------------------------------------------

    def _load_from_db(self) -> None:
        """Restore bets and runtime state from SQLite on startup."""
        from src.database import load_all_bets, load_state

        # Restore bets
        for row in load_all_bets(self._db):
            bet = Bet(
                id=row["id"],
                bet_id=row["bet_id"],
                broker_name=row["broker_name"],
                sport=row["sport"],
                legs=json.loads(row["legs"]),
                stake=row["stake"],
                odds=row["odds"],
                expected_value=row["expected_value"],
                status=row["status"],
                result=row["result"],
                placed_at=datetime.fromisoformat(row["placed_at"]),
                settled_at=datetime.fromisoformat(row["settled_at"]) if row["settled_at"] else None,
            )
            self._bets[bet.id] = bet

        # Restore runtime scalars
        saved_bankroll = load_state(self._db, "bankroll")
        if saved_bankroll:
            self.bankroll = float(saved_bankroll)
        saved_pnl = load_state(self._db, "daily_pnl")
        if saved_pnl:
            self._daily_pnl = float(saved_pnl)
        saved_cool = load_state(self._db, "is_cooling_down")
        if saved_cool:
            self._is_cooling_down = saved_cool == "1"

    def _persist_bet(self, bet: Bet) -> None:
        """Write a single bet to SQLite."""
        if self._db is None:
            return
        from src.database import save_bet
        save_bet(self._db, bet)

    def _persist_state(self) -> None:
        """Flush runtime scalars (bankroll, pnl, cooldown) to SQLite."""
        if self._db is None:
            return
        from src.database import save_state
        save_state(self._db, "bankroll", str(self.bankroll))
        save_state(self._db, "daily_pnl", str(self._daily_pnl))
        save_state(self._db, "is_cooling_down", "1" if self._is_cooling_down else "0")

    @staticmethod
    def _serialize_leg(leg: object) -> dict:
        """Convert a parlay leg into a JSON-serializable mapping."""
        if is_dataclass(leg):
            return asdict(leg)
        if isinstance(leg, dict):
            return dict(leg)
        return vars(leg)

    # ------------------------------------------------------------------
    # Read-only properties for observability / testing
    # ------------------------------------------------------------------

    @property
    def daily_pnl(self) -> float:
        """Today's realised profit and loss (resets each trading day)."""
        return self._daily_pnl

    @property
    def is_cooling_down(self) -> bool:
        """True when the stop-loss has been triggered and no bets should be placed."""
        return self._is_cooling_down

    # ------------------------------------------------------------------
    # Bankroll management — Kelly criterion
    # ------------------------------------------------------------------

    def kelly_stake(self, win_probability: float, decimal_odds: float) -> float:
        """
        Return a recommended stake using fractional Kelly criterion.

        Formula: f = (b*p - q) / b   where b = decimal_odds - 1, q = 1 - p
        The result is then scaled by ``kelly_fraction`` and capped at
        ``max_exposure_pct`` of the current bankroll.

        Parameters
        ----------
        win_probability:
            Estimated probability of winning (0–1).
        decimal_odds:
            European/decimal odds offered by the broker.

        Returns
        -------
        Recommended stake in dollars (always >= 0).
        """
        if win_probability < 0.0 or decimal_odds < 0.0:
            return 0.0
        if decimal_odds <= 1.0 or not (0 < win_probability < 1):
            return 0.0

        b = decimal_odds - 1.0
        q = 1.0 - win_probability
        kelly_full = (b * win_probability - q) / b

        if kelly_full <= 0:
            return 0.0  # negative edge — skip

        fractional = kelly_full * self.kelly_fraction
        max_stake = self.bankroll * self.max_exposure_pct
        stake = min(fractional * self.bankroll, max_stake)
        if stake < settings.MIN_BET_AMOUNT:
            logger.debug(
                "Kelly stake %.2f below minimum bet %.2f",
                stake,
                settings.MIN_BET_AMOUNT,
            )
            return 0.0
        logger.debug(
            "Kelly stake: p=%.3f odds=%.2f full_kelly=%.4f stake=%.2f",
            win_probability,
            decimal_odds,
            kelly_full,
            stake,
        )
        return round(stake, 2)

    # ------------------------------------------------------------------
    # Stop-loss and cool-down
    # ------------------------------------------------------------------

    def check_stop_loss(self) -> bool:
        """
        Return True (and activate cool-down) if daily loss limit is breached.

        The cool-down flag prevents further bet placement until it is
        explicitly cleared (e.g., at the start of the next trading day).
        """
        if self._is_cooling_down:
            logger.warning("Cool-down active — no new bets allowed.")
            return True

        loss_limit = self.bankroll * self.max_daily_loss_pct
        if self._daily_pnl <= -loss_limit:
            self._is_cooling_down = True
            self._persist_state()
            logger.warning(
                "Stop-loss triggered! Daily P&L=%.2f limit=%.2f — cool-down activated.",
                self._daily_pnl,
                loss_limit,
            )
            return True

        return False

    def reset_daily_limits(self) -> None:
        """Call at the start of each new trading day to reset P&L and cool-down."""
        self._daily_pnl = 0.0
        self._is_cooling_down = False
        self._persist_state()
        logger.info("Daily limits reset — cool-down cleared, P&L zeroed.")

    # ------------------------------------------------------------------
    # Exposure monitoring
    # ------------------------------------------------------------------

    def get_exposure(self) -> dict[str, float | int | dict[str, float]]:
        """
        Return current open exposure broken down by broker and sport.

        Returns a dict with total open stake and per-dimension breakdowns.
        """
        open_bets = [b for b in self._bets.values() if b.status == "pending"]
        total_stake = sum(b.stake for b in open_bets)

        by_broker: dict[str, float] = {}
        by_sport: dict[str, float] = {}
        for b in open_bets:
            by_broker[b.broker_name] = by_broker.get(b.broker_name, 0.0) + b.stake
            by_sport[b.sport] = by_sport.get(b.sport, 0.0) + b.stake

        if self.bankroll <= 0:
            logger.warning("Bankroll is non-positive (%.2f) — exposure percentage is unavailable.", self.bankroll)

        return {
            "total_open_stake": round(total_stake, 2),
            "open_bet_count": len(open_bets),
            "by_broker": by_broker,
            "by_sport": by_sport,
            "exposure_pct": round(total_stake / self.bankroll * 100, 2) if self.bankroll > 0 else 0.0,
        }

    async def get_all_bets(self) -> list[Bet]:
        """Return a snapshot of all bets."""
        async with self._lock:
            return list(self._bets.values())

    # ------------------------------------------------------------------
    # Audit trail
    # ------------------------------------------------------------------

    async def record_bet(self, parlay: Parlay, bet_id: str, broker_name: str) -> Bet:
        """
        Record a newly placed bet for audit-trail and exposure tracking.

        Parameters
        ----------
        parlay:
            The Parlay object returned by ParlayOptimizer.
        bet_id:
            Broker-assigned confirmation ID.
        broker_name:
            Key identifying the broker (e.g. "draftkings", "prizepicks").
        """
        stake = parlay.recommended_stake
        if stake > self.bankroll:
            raise ValueError(f"Insufficient bankroll: ${self.bankroll:.2f} < ${stake:.2f}")

        record_id = str(uuid.uuid4())
        legs = [self._serialize_leg(leg) for leg in parlay.legs]
        bet = Bet(
            id=record_id,
            bet_id=bet_id,
            broker_name=broker_name,
            sport=parlay.sport,
            legs=legs,
            stake=stake,
            odds=parlay.odds,
            expected_value=parlay.expected_value,
        )
        async with self._lock:
            self._persist_bet(bet)
            self._bets[record_id] = bet
        logger.info(
            "Bet recorded | id=%s bet_id=%s broker=%s sport=%s stake=%.2f",
            record_id,
            bet_id,
            broker_name,
            bet.sport,
            bet.stake,
        )
        return bet

    async def get_pending_bets(self) -> list[Bet]:
        """Return all bets that have not yet been settled."""
        async with self._lock:
            return [b for b in self._bets.values() if b.status == "pending"]

    async def settle_bet(self, bet_internal_id: str, result: str) -> Bet | None:
        """
        Settle a bet and update bankroll / daily P&L.

        Parameters
        ----------
        bet_internal_id:
            The ``id`` field on the Bet record (not the broker ID).
        result:
            "won" or "lost" (or "void" for cancelled/push).
        """
        async with self._lock:
            bet = self._bets.get(bet_internal_id)
            if bet is None:
                logger.warning("settle_bet: unknown bet id %s", bet_internal_id)
                return None

            bet.status = result
            bet.result = result
            bet.settled_at = datetime.now(timezone.utc)

            if result == "won":
                profit = bet.stake * (bet.odds - 1)
                self.bankroll += profit
                self._daily_pnl += profit
                logger.info("Bet %s WON — profit=%.2f new_bankroll=%.2f", bet.bet_id, profit, self.bankroll)
            elif result == "lost":
                self.bankroll -= bet.stake
                self.bankroll = max(0.0, self.bankroll)
                self._daily_pnl -= bet.stake
                logger.info("Bet %s LOST — stake=%.2f new_bankroll=%.2f", bet.bet_id, bet.stake, self.bankroll)
                # Re-evaluate stop-loss after a loss
                self.check_stop_loss()
            else:
                logger.info("Bet %s result=%s — no P&L change.", bet.bet_id, result)

            self._persist_bet(bet)
            self._persist_state()

        return bet
