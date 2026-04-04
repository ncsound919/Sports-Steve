"""
src/config.py — Application settings.

Override via environment variables or a .env file.
"""

import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    """Central configuration for Sports-Steve."""

    # Sports to monitor for daily bet assessment
    ACTIVE_SPORTS: list[str] = field(
        default_factory=lambda: os.getenv(
            "ACTIVE_SPORTS", "NFL,NBA,NHL,MLB"
        ).split(",")
    )

    # Maximum daily stake budget (USD)
    MAX_DAILY_STAKE: float = float(os.getenv("MAX_DAILY_STAKE", "100.0"))

    # Minimum edge threshold for placing bets
    MIN_EDGE: float = float(os.getenv("MIN_EDGE", "0.05"))

    # PrizePicks auth token (optional — needed for real bet placement)
    PRIZEPICKS_AUTH_TOKEN: str = os.getenv("PRIZEPICKS_AUTH_TOKEN", "")

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


settings = Settings()
