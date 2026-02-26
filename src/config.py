"""
src/config.py — Application settings.

Override via environment variables or a .env file.
"""

import os
from dataclasses import dataclass, field
from typing import List


@dataclass
class Settings:
    """Central configuration for Sports-Steve."""

    # Sports to monitor for daily bet assessment
    ACTIVE_SPORTS: List[str] = field(
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

    # Logging level
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()
