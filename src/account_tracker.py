"""
src/account_tracker.py — Multi-sportsbook account tracking for Sports-Steve.

Tracks balances, activity, and health across multiple sportsbook accounts.

Features
--------
* Register sportsbook accounts with name, starting balance, and optional limits.
* Record deposits, withdrawals, and bet outcomes per account.
* Monitor account health (flag accounts at risk of limits/bans).
* Aggregate total funds across all sportsbooks.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class AccountTransaction:
    """Records a single financial event on a sportsbook account."""

    id: str
    account_id: str
    txn_type: str           # "deposit" | "withdrawal" | "bet_win" | "bet_loss" | "bet_void"
    amount: float           # always positive; direction implied by txn_type
    description: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class SportsbookAccount:
    """
    Represents a single sportsbook account.

    Parameters
    ----------
    name:
        Human-readable sportsbook name (e.g. "DraftKings", "FanDuel").
    account_id:
        Internal unique identifier (auto-generated if not supplied).
    balance:
        Current account balance (USD).
    max_bet:
        Sportsbook-imposed maximum single bet limit (None = unknown).
    is_limited:
        True when the book has limited/restricted the account.
    is_gubbed:
        True when the account has been gubbed (bonus offers removed).
    """

    name: str
    account_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    balance: float = 0.0
    max_bet: float | None = None
    is_limited: bool = False
    is_gubbed: bool = False
    notes: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    transactions: list[AccountTransaction] = field(default_factory=list)

    def deposit(self, amount: float, description: str = "") -> AccountTransaction:
        """Record a deposit and update the balance."""
        if amount <= 0:
            raise ValueError(f"Deposit amount must be positive, got {amount}")
        txn = AccountTransaction(
            id=str(uuid.uuid4()),
            account_id=self.account_id,
            txn_type="deposit",
            amount=amount,
            description=description,
        )
        self.balance += amount
        self.transactions.append(txn)
        logger.info("Account %s (%s) deposit +%.2f → balance=%.2f", self.name, self.account_id, amount, self.balance)
        return txn

    def withdraw(self, amount: float, description: str = "") -> AccountTransaction:
        """Record a withdrawal and update the balance."""
        if amount <= 0:
            raise ValueError(f"Withdrawal amount must be positive, got {amount}")
        if amount > self.balance:
            raise ValueError(
                f"Insufficient balance on {self.name}: requested {amount:.2f}, have {self.balance:.2f}"
            )
        txn = AccountTransaction(
            id=str(uuid.uuid4()),
            account_id=self.account_id,
            txn_type="withdrawal",
            amount=amount,
            description=description,
        )
        self.balance -= amount
        self.transactions.append(txn)
        logger.info("Account %s (%s) withdrawal -%.2f → balance=%.2f", self.name, self.account_id, amount, self.balance)
        return txn

    def apply_bet_result(
        self, stake: float, odds: float, result: str
    ) -> AccountTransaction:
        """
        Update the balance based on a bet outcome.

        Parameters
        ----------
        stake:
            Amount staked.
        odds:
            Decimal odds of the bet.
        result:
            "won", "lost", or "void".
        """
        if result == "won":
            profit = stake * (odds - 1.0)
            txn = AccountTransaction(
                id=str(uuid.uuid4()),
                account_id=self.account_id,
                txn_type="bet_win",
                amount=profit,
                description=f"Bet won — stake {stake:.2f} @ {odds}",
            )
            self.balance += profit
        elif result == "lost":
            txn = AccountTransaction(
                id=str(uuid.uuid4()),
                account_id=self.account_id,
                txn_type="bet_loss",
                amount=stake,
                description=f"Bet lost — stake {stake:.2f} @ {odds}",
            )
            self.balance -= stake
        else:  # void / push
            txn = AccountTransaction(
                id=str(uuid.uuid4()),
                account_id=self.account_id,
                txn_type="bet_void",
                amount=0.0,
                description=f"Bet voided — stake {stake:.2f} @ {odds}",
            )
        self.transactions.append(txn)
        logger.info(
            "Account %s bet result=%s stake=%.2f odds=%.2f → balance=%.2f",
            self.name, result, stake, odds, self.balance,
        )
        return txn

    def summary(self) -> dict[str, Any]:
        """Return a summary dict for reporting."""
        wins = sum(t.amount for t in self.transactions if t.txn_type == "bet_win")
        losses = sum(t.amount for t in self.transactions if t.txn_type == "bet_loss")
        return {
            "name": self.name,
            "account_id": self.account_id,
            "balance": round(self.balance, 2),
            "total_bet_winnings": round(wins, 2),
            "total_bet_losses": round(losses, 2),
            "net_betting_pnl": round(wins - losses, 2),
            "is_limited": self.is_limited,
            "is_gubbed": self.is_gubbed,
            "transaction_count": len(self.transactions),
        }


# ---------------------------------------------------------------------------
# Account tracker
# ---------------------------------------------------------------------------


class AccountTracker:
    """
    Central registry for all sportsbook accounts.

    Usage
    -----
    >>> tracker = AccountTracker()
    >>> dk = tracker.add_account("DraftKings", initial_balance=500.0)
    >>> pp = tracker.add_account("PrizePicks", initial_balance=200.0)
    >>> tracker.total_balance()
    700.0
    >>> tracker.account_summary()
    [{'name': 'DraftKings', ...}, {'name': 'PrizePicks', ...}]
    """

    def __init__(self):
        self._accounts: dict[str, SportsbookAccount] = {}
        logger.info("AccountTracker initialized.")

    # ------------------------------------------------------------------
    # Account management
    # ------------------------------------------------------------------

    def add_account(
        self,
        name: str,
        initial_balance: float = 0.0,
        max_bet: float | None = None,
        account_id: str | None = None,
    ) -> SportsbookAccount:
        """
        Register a new sportsbook account.

        Parameters
        ----------
        name:
            Sportsbook name.
        initial_balance:
            Starting balance on the account.
        max_bet:
            Sportsbook's maximum single-bet limit (optional).
        account_id:
            Override auto-generated ID (useful for persistence).

        Returns
        -------
        The newly created :class:`SportsbookAccount`.
        """
        account = SportsbookAccount(
            name=name,
            balance=initial_balance,
            max_bet=max_bet,
        )
        if account_id:
            account.account_id = account_id
        self._accounts[account.account_id] = account
        logger.info("Added account: %s (id=%s) balance=%.2f", name, account.account_id, initial_balance)
        return account

    def get_account(self, account_id: str) -> SportsbookAccount | None:
        """Return the account with the given ID, or None."""
        return self._accounts.get(account_id)

    def get_account_by_name(self, name: str) -> SportsbookAccount | None:
        """Return the first account whose name matches (case-insensitive)."""
        name_lower = name.lower()
        for acc in self._accounts.values():
            if acc.name.lower() == name_lower:
                return acc
        return None

    def list_accounts(self) -> list[SportsbookAccount]:
        """Return all registered accounts."""
        return list(self._accounts.values())

    def remove_account(self, account_id: str) -> bool:
        """Remove an account. Returns True if found and removed."""
        if account_id in self._accounts:
            del self._accounts[account_id]
            logger.info("Removed account id=%s", account_id)
            return True
        return False

    # ------------------------------------------------------------------
    # Financial operations
    # ------------------------------------------------------------------

    def apply_bet_result(
        self,
        account_id: str,
        stake: float,
        odds: float,
        result: str,
    ) -> AccountTransaction | None:
        """
        Apply a bet result to the named account.

        Returns the :class:`AccountTransaction` or None if account not found.
        """
        account = self._accounts.get(account_id)
        if account is None:
            logger.warning("apply_bet_result: unknown account_id=%s", account_id)
            return None
        return account.apply_bet_result(stake, odds, result)

    # ------------------------------------------------------------------
    # Reporting
    # ------------------------------------------------------------------

    def total_balance(self) -> float:
        """Return the sum of balances across all registered accounts."""
        return round(sum(acc.balance for acc in self._accounts.values()), 2)

    def account_summary(self) -> list[dict[str, Any]]:
        """Return a list of summary dicts for all accounts."""
        return [acc.summary() for acc in self._accounts.values()]

    def health_report(self) -> list[dict[str, Any]]:
        """
        Return accounts that may need attention:
        limited, gubbed, or with balance below $10.
        """
        flagged = []
        for acc in self._accounts.values():
            flags = []
            if acc.is_limited:
                flags.append("limited")
            if acc.is_gubbed:
                flags.append("gubbed")
            if acc.balance < 10.0:
                flags.append("low_balance")
            if flags:
                flagged.append({**acc.summary(), "flags": flags})
        return flagged
