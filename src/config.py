"""
src/config.py - Application settings.

Override via environment variables or a .env file (loaded automatically via python-dotenv).
"""

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

# Load .env from the project root (two levels up from src/)
load_dotenv()


@dataclass
class Settings:
    """Central configuration for Sports-Steve."""

    # Sports to monitor for daily bet assessment
    ACTIVE_SPORTS: list = field(
        default_factory=lambda: os.getenv("ACTIVE_SPORTS", "NFL,NBA,NHL,MLB").split(",")
    )

    # Maximum daily stake budget (USD)
    MAX_DAILY_STAKE: float = float(os.getenv("MAX_DAILY_STAKE", "100.0"))

    # Hard cap on bets placed per day
    MAX_BETS_PER_DAY: int = int(os.getenv("MAX_BETS_PER_DAY", "5"))

    # Minimum edge threshold for placing bets (e.g. 0.05 = 5%)
    MIN_EDGE: float = float(os.getenv("MIN_EDGE", "0.05"))

    # Edge quality gates
    MIN_EDGE_RATIO: float = float(os.getenv("MIN_EDGE_RATIO", "1.05"))
    MIN_WIN_PROBABILITY: float = float(os.getenv("MIN_WIN_PROBABILITY", "0.55"))
    MIN_CONSENSUS_BOOKS: int = int(os.getenv("MIN_CONSENSUS_BOOKS", "1"))
    MIN_PLAYER_CONFIDENCE: float = float(os.getenv("MIN_PLAYER_CONFIDENCE", "0.60"))

    # Monte Carlo simulation parameters
    MONTE_CARLO_N_SIMS: int = int(os.getenv("MONTE_CARLO_N_SIMS", "1000"))
    MONTE_CARLO_MAX_RUIN_PCT: float = float(
        os.getenv("MONTE_CARLO_MAX_RUIN_PCT", "0.10")
    )

    # PrizePicks authentication - cookie-based session (no Bearer token)
    PRIZEPICKS_SESSION_COOKIE: str = os.getenv("PRIZEPICKS_SESSION_COOKIE", "")
    PRIZEPICKS_CSRF_TOKEN: str = os.getenv("PRIZEPICKS_CSRF_TOKEN", "")
    # Legacy Bearer token (unused - kept for backwards compatibility)
    PRIZEPICKS_AUTH_TOKEN: str = os.getenv("PRIZEPICKS_AUTH_TOKEN", "")

    # Third-party odds APIs
    THE_ODDS_API_KEY: str = os.getenv("THE_ODDS_API_KEY", "")
    THE_RUNDOWN_API_KEY: str = os.getenv("THE_RUNDOWN_API_KEY", "")

    # Risk management settings
    RISK_BANKROLL: float = float(os.getenv("RISK_BANKROLL", "1000.0"))
    RISK_MAX_DAILY_LOSS_PCT: float = float(os.getenv("RISK_MAX_DAILY_LOSS_PCT", "0.10"))
    RISK_MAX_EXPOSURE_PCT: float = float(os.getenv("RISK_MAX_EXPOSURE_PCT", "0.20"))
    RISK_KELLY_FRACTION: float = float(os.getenv("RISK_KELLY_FRACTION", "0.25"))

    # Circadian factoring
    CIRCADIAN_ENABLED: bool = os.getenv("CIRCADIAN_ENABLED", "true").lower() == "true"

    # Budgeting (daily / weekly / monthly limits; 0 = disabled)
    BUDGET_DAILY_LIMIT: float = float(os.getenv("BUDGET_DAILY_LIMIT", "0.0"))
    BUDGET_WEEKLY_LIMIT: float = float(os.getenv("BUDGET_WEEKLY_LIMIT", "0.0"))
    BUDGET_MONTHLY_LIMIT: float = float(os.getenv("BUDGET_MONTHLY_LIMIT", "0.0"))

    # Logging level
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Uvicorn server port
    PORT: int = int(os.getenv("PORT", "8000"))


settings = Settings()
