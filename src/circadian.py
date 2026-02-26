"""
src/circadian.py — Circadian factoring for Sports-Steve.

Adjusts bet edge/confidence based on game-time circadian effects:
  - Late-night games (fatigue penalty for teams in early time zones)
  - Back-to-back schedules (cumulative fatigue)
  - Cross-country travel (timezone shift penalty)
  - Optimal performance windows per team/sport
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, time as dt_time

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------

# Local hour ranges considered "optimal" and "suboptimal" for athletes
_OPTIMAL_HOUR_RANGE = range(14, 21)     # hours 14–20 inclusive (2 PM–8 PM local)
_LATE_NIGHT_HOUR = 21                   # 21:00+ → fatigue penalty applies

# Penalty / bonus magnitudes (multiplicative on edge estimate)
_LATE_NIGHT_PENALTY = 0.05     # 5 % edge reduction for very late games
_BACK_TO_BACK_PENALTY = 0.08   # 8 % edge reduction for back-to-back team
_TIMEZONE_SHIFT_PENALTY = 0.04 # 4 % per hour of eastward cross-country shift
_OPTIMAL_BONUS = 0.02          # 2 % edge bonus for games in optimal window

# Sports known to have significant circadian sensitivity
_CIRCADIAN_SENSITIVE_SPORTS = {"NBA", "NHL", "NFL", "NCAAMB"}


@dataclass
class GameContext:
    """
    Contextual information about a game used for circadian adjustment.

    Parameters
    ----------
    game_time_utc:
        UTC tip-off / kick-off time.
    home_team_timezone_offset:
        UTC offset (hours) of the home team's city (e.g. -5 for EST).
    away_team_timezone_offset:
        UTC offset (hours) of the away team's city.
    sport:
        Sport identifier (e.g. "NBA", "NFL").
    away_team_back_to_back:
        True if the away team played the previous night.
    home_team_back_to_back:
        True if the home team played the previous night.
    """

    game_time_utc: datetime
    home_team_timezone_offset: float = -5.0   # defaults to EST
    away_team_timezone_offset: float = -5.0
    sport: str = "NBA"
    away_team_back_to_back: bool = False
    home_team_back_to_back: bool = False

    def home_local_hour(self) -> int:
        """Return the game's local start hour at the home venue."""
        utc_hour = self.game_time_utc.hour + self.game_time_utc.minute / 60
        return int((utc_hour + self.home_team_timezone_offset) % 24)

    def away_travel_shift(self) -> float:
        """
        Hours the away team's body-clock is shifted from the home timezone.
        Positive = eastward travel (more disruptive).
        """
        return self.home_team_timezone_offset - self.away_team_timezone_offset


@dataclass
class CircadianAdjustment:
    """
    Multiplicative edge adjustment derived from circadian analysis.

    ``factor`` is applied to the raw edge estimate:
        adjusted_edge = raw_edge * (1 + factor)

    A negative factor reduces confidence; a positive factor increases it.
    """

    factor: float = 0.0
    reasons: list[str] = field(default_factory=list)

    def apply(self, raw_edge: float) -> float:
        """Return raw_edge scaled by (1 + factor), floored at zero."""
        return max(0.0, raw_edge * (1.0 + self.factor))


class CircadianFactoring:
    """
    Computes circadian adjustment factors for a given game context.

    Usage
    -----
    >>> cf = CircadianFactoring()
    >>> ctx = GameContext(game_time_utc=datetime(2024, 1, 15, 2, 0, tzinfo=timezone.utc),
    ...                   away_team_timezone_offset=-5, home_team_timezone_offset=-8,
    ...                   sport="NBA", away_team_back_to_back=True)
    >>> adj = cf.compute(ctx)
    >>> adjusted_edge = adj.apply(raw_edge=0.06)
    """

    def __init__(
        self,
        late_night_penalty: float = _LATE_NIGHT_PENALTY,
        back_to_back_penalty: float = _BACK_TO_BACK_PENALTY,
        timezone_shift_penalty: float = _TIMEZONE_SHIFT_PENALTY,
        optimal_bonus: float = _OPTIMAL_BONUS,
    ):
        self.late_night_penalty = late_night_penalty
        self.back_to_back_penalty = back_to_back_penalty
        self.timezone_shift_penalty = timezone_shift_penalty
        self.optimal_bonus = optimal_bonus

    def compute(self, ctx: GameContext) -> CircadianAdjustment:
        """
        Compute the combined circadian factor for a game.

        Returns a :class:`CircadianAdjustment` with a ``factor`` in the
        range ``(-1, +1)`` and human-readable ``reasons``.
        """
        factor = 0.0
        reasons: list[str] = []

        if ctx.sport.upper() not in _CIRCADIAN_SENSITIVE_SPORTS:
            logger.debug("Sport %s not circadian-sensitive — no adjustment.", ctx.sport)
            return CircadianAdjustment(factor=0.0, reasons=["Sport not circadian-sensitive"])

        home_hour = ctx.home_local_hour()

        # 1. Late-night game penalty (affects both teams, especially visitors)
        if home_hour >= _LATE_NIGHT_HOUR:
            factor -= self.late_night_penalty
            reasons.append(f"Late-night game (local hour {home_hour}) → -{self.late_night_penalty:.0%}")

        # 2. Optimal performance window bonus
        elif home_hour in _OPTIMAL_HOUR_RANGE:
            factor += self.optimal_bonus
            reasons.append(f"Optimal tip-off hour ({home_hour}:00) → +{self.optimal_bonus:.0%}")

        # 3. Away team back-to-back penalty
        if ctx.away_team_back_to_back:
            factor -= self.back_to_back_penalty
            reasons.append(f"Away team B2B → -{self.back_to_back_penalty:.0%}")

        # 4. Home team back-to-back (lesser penalty — home court advantage partially offsets)
        if ctx.home_team_back_to_back:
            half_penalty = self.back_to_back_penalty / 2
            factor -= half_penalty
            reasons.append(f"Home team B2B → -{half_penalty:.0%}")

        # 5. Cross-country timezone shift for away team (eastward travel hurts more)
        shift = ctx.away_travel_shift()
        if shift > 1.5:   # more than 1.5 hours eastward
            penalty = min(shift * self.timezone_shift_penalty, 0.20)  # cap at 20%
            factor -= penalty
            reasons.append(
                f"Away team eastward travel shift {shift:.1f}h → -{penalty:.0%}"
            )
        elif shift < -1.5:  # westward travel is less disruptive — slight bonus
            bonus = min(abs(shift) * self.timezone_shift_penalty / 2, 0.05)
            factor += bonus
            reasons.append(
                f"Away team westward travel {abs(shift):.1f}h → +{bonus:.0%}"
            )

        logger.debug(
            "CircadianFactoring: sport=%s hour=%d shift=%.1f factor=%.4f reasons=%s",
            ctx.sport, home_hour, shift, factor, reasons,
        )
        return CircadianAdjustment(factor=round(factor, 4), reasons=reasons)
