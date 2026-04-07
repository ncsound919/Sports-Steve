"""
src/database.py — SQLite persistence layer for Sports-Steve.

Provides durable storage for:
  - Bets (RiskManager audit trail)
  - Budget entries (BudgetManager spend records)
  - Sportsbook accounts and transactions (AccountTracker)
  - Runtime state (bankroll, daily P&L, cool-down flag)

All tables are created idempotently on init via CREATE TABLE IF NOT EXISTS.
"""

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# Default DB location: <project_root>/data/sports_steve.db
_DEFAULT_DB_DIR = Path(__file__).resolve().parent.parent / "data"
_DEFAULT_DB_PATH = _DEFAULT_DB_DIR / "sports_steve.db"


def get_db_path() -> str:
    """Return the database path from env or the default."""
    return os.getenv("SPORTS_STEVE_DB", str(_DEFAULT_DB_PATH))


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    """Open (or create) the SQLite database and return a connection."""
    path = db_path or get_db_path()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Create all tables if they don't already exist."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS bets (
            id                TEXT PRIMARY KEY,
            bet_id            TEXT NOT NULL,
            broker_name       TEXT NOT NULL,
            sport             TEXT NOT NULL,
            legs              TEXT NOT NULL,          -- JSON array
            stake             REAL NOT NULL,
            odds              REAL NOT NULL,
            expected_value    REAL NOT NULL DEFAULT 0.0,
            status            TEXT NOT NULL DEFAULT 'pending',
            result            TEXT,
            placed_at         TEXT NOT NULL,
            settled_at        TEXT
        );

        CREATE TABLE IF NOT EXISTS budget_entries (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            bet_id            TEXT NOT NULL,
            amount            REAL NOT NULL,
            sport             TEXT NOT NULL DEFAULT 'unknown',
            sportsbook        TEXT NOT NULL DEFAULT 'unknown',
            timestamp         TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sportsbook_accounts (
            account_id        TEXT PRIMARY KEY,
            name              TEXT NOT NULL,
            balance           REAL NOT NULL DEFAULT 0.0,
            max_bet           REAL,
            is_limited        INTEGER NOT NULL DEFAULT 0,
            is_gubbed         INTEGER NOT NULL DEFAULT 0,
            notes             TEXT NOT NULL DEFAULT '',
            created_at        TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS account_transactions (
            id                TEXT PRIMARY KEY,
            account_id        TEXT NOT NULL,
            txn_type          TEXT NOT NULL,
            amount            REAL NOT NULL,
            description       TEXT NOT NULL DEFAULT '',
            timestamp         TEXT NOT NULL,
            FOREIGN KEY (account_id) REFERENCES sportsbook_accounts(account_id)
        );

        CREATE TABLE IF NOT EXISTS runtime_state (
            key               TEXT PRIMARY KEY,
            value             TEXT NOT NULL
        );
    """)
    conn.commit()
    logger.info("Database tables initialised at %s", conn.execute("PRAGMA database_list").fetchone()[2])


# ---------------------------------------------------------------------------
# Bets CRUD
# ---------------------------------------------------------------------------

def save_bet(conn: sqlite3.Connection, bet) -> None:
    """Insert or replace a bet record."""
    conn.execute(
        """INSERT OR REPLACE INTO bets
           (id, bet_id, broker_name, sport, legs, stake, odds, expected_value,
            status, result, placed_at, settled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            bet.id,
            bet.bet_id,
            bet.broker_name,
            bet.sport,
            json.dumps(bet.legs),
            bet.stake,
            bet.odds,
            bet.expected_value,
            bet.status,
            bet.result,
            bet.placed_at.isoformat(),
            bet.settled_at.isoformat() if bet.settled_at else None,
        ),
    )
    conn.commit()


def load_all_bets(conn: sqlite3.Connection) -> list[dict]:
    """Return all bet rows as dicts."""
    rows = conn.execute("SELECT * FROM bets ORDER BY placed_at").fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Budget entries CRUD
# ---------------------------------------------------------------------------

def save_budget_entry(conn: sqlite3.Connection, entry) -> None:
    """Insert a budget entry."""
    conn.execute(
        """INSERT INTO budget_entries (bet_id, amount, sport, sportsbook, timestamp)
           VALUES (?, ?, ?, ?, ?)""",
        (entry.bet_id, entry.amount, entry.sport, entry.sportsbook, entry.timestamp.isoformat()),
    )
    conn.commit()


def load_budget_entries(conn: sqlite3.Connection) -> list[dict]:
    """Return all budget entry rows as dicts."""
    rows = conn.execute("SELECT * FROM budget_entries ORDER BY timestamp").fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Sportsbook accounts CRUD
# ---------------------------------------------------------------------------

def save_account(conn: sqlite3.Connection, account) -> None:
    """Insert or replace a sportsbook account (without transactions)."""
    conn.execute(
        """INSERT OR REPLACE INTO sportsbook_accounts
           (account_id, name, balance, max_bet, is_limited, is_gubbed, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            account.account_id,
            account.name,
            account.balance,
            account.max_bet,
            int(account.is_limited),
            int(account.is_gubbed),
            account.notes,
            account.created_at.isoformat(),
        ),
    )
    conn.commit()


def save_transaction(conn: sqlite3.Connection, txn) -> None:
    """Insert an account transaction."""
    conn.execute(
        """INSERT OR REPLACE INTO account_transactions
           (id, account_id, txn_type, amount, description, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (txn.id, txn.account_id, txn.txn_type, txn.amount, txn.description, txn.timestamp.isoformat()),
    )
    conn.commit()


def load_accounts(conn: sqlite3.Connection) -> list[dict]:
    """Return all sportsbook account rows."""
    rows = conn.execute("SELECT * FROM sportsbook_accounts ORDER BY created_at").fetchall()
    return [dict(r) for r in rows]


def load_transactions(conn: sqlite3.Connection, account_id: str) -> list[dict]:
    """Return all transactions for a given account."""
    rows = conn.execute(
        "SELECT * FROM account_transactions WHERE account_id = ? ORDER BY timestamp",
        (account_id,),
    ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Runtime state (key-value)
# ---------------------------------------------------------------------------

def save_state(conn: sqlite3.Connection, key: str, value: str) -> None:
    """Upsert a runtime state key-value pair."""
    conn.execute(
        "INSERT OR REPLACE INTO runtime_state (key, value) VALUES (?, ?)",
        (key, value),
    )
    conn.commit()


def load_state(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    """Load a runtime state value by key."""
    row = conn.execute("SELECT value FROM runtime_state WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default
