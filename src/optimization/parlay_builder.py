"""
src/optimization/parlay_builder.py — Parlay builder for Sports-Steve.

Implements:
  - Leg and Parlay data classes
  - ParlayBuilder: combines candidate legs into parlays with combined
    odds, win probability, and expected-value calculation
  - ParlayOptimizer: generates optimized parlay candidates, with optional
    circadian edge adjustment
"""

import itertools
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
class Leg:
    """A single leg of a parlay."""
    event_id: str
    selection: str
    odds: float
    win_probability: float = 0.0
    game_time_utc: datetime | None = None
    home_tz_offset: float = -5.0
    away_tz_offset: float = -5.0
    away_back_to_back: bool = False
    home_back_to_back: bool = False


@dataclass
class Parlay:
    """A candidate parlay to be placed."""
    id: str
    sport: str
    legs: list[Leg] = field(default_factory=list)
    odds: float = 0.0
    recommended_stake: float = 0.0
    expected_value: float = 0.0
    win_probability: float = 0.0


# ---------------------------------------------------------------------------
# Parlay builder
# ---------------------------------------------------------------------------


class ParlayBuilder:
    """
    Combines individual :class:`Leg` candidates into :class:`Parlay` objects.

    Responsibilities
    ----------------
    * Compute combined parlay odds (product of decimal leg odds).
    * Estimate parlay win probability (product of individual leg probabilities).
    * Calculate expected value: EV = win_probability * (odds - 1) - (1 - win_probability).
    * Apply optional circadian edge adjustment via :class:`~src.circadian.CircadianFactoring`.
    """

    def __init__(self, use_circadian: bool = True):
        self.use_circadian = use_circadian
        if use_circadian:
            from src.circadian import CircadianFactoring
            self._circadian = CircadianFactoring()
        else:
            self._circadian = None

    def build(
        self,
        legs: list[Leg],
        sport: str,
        bankroll: float = 100.0,
        kelly_fraction: float = 0.25,
        max_exposure_pct: float = 0.20,
    ) -> Parlay:
        """
        Build a :class:`Parlay` from a list of legs.

        Parameters
        ----------
        legs:
            Individual bet legs (each with decimal odds and win probability).
        sport:
            Sport identifier used for circadian lookup.
        bankroll:
            Current bankroll for stake sizing.
        kelly_fraction:
            Fractional Kelly multiplier.
        max_exposure_pct:
            Maximum fraction of bankroll to stake on any single parlay.

        Returns
        -------
        A :class:`Parlay` with combined odds, EV and recommended_stake filled in.
        """
        if not legs:
            raise ValueError("Cannot build a parlay with no legs.")

        combined_odds = 1.0
        combined_win_prob = 1.0
        for leg in legs:
            combined_odds *= leg.odds
            if leg.win_probability > 0:
                combined_win_prob *= leg.win_probability

        # Expected value (per unit stake)
        ev = combined_win_prob * (combined_odds - 1.0) - (1.0 - combined_win_prob)

        # Apply circadian adjustment to EV if enabled and game_time data available
        if self._circadian is not None:
            from src.circadian import GameContext
            for leg in legs:
                if leg.game_time_utc is not None:
                    ctx = GameContext(
                        game_time_utc=leg.game_time_utc,
                        home_team_timezone_offset=leg.home_tz_offset,
                        away_team_timezone_offset=leg.away_tz_offset,
                        sport=sport,
                        away_team_back_to_back=leg.away_back_to_back,
                        home_team_back_to_back=leg.home_back_to_back,
                    )
                    adj = self._circadian.compute(ctx)
                    ev = adj.apply(ev)
                    logger.debug(
                        "Circadian adjustment for leg %s: factor=%.4f reasons=%s",
                        leg.event_id, adj.factor, adj.reasons,
                    )

        # Kelly stake sizing
        b = combined_odds - 1.0
        if combined_win_prob > 0 and combined_win_prob < 1 and b > 0:
            kelly_full = (b * combined_win_prob - (1.0 - combined_win_prob)) / b
            if kelly_full > 0:
                stake = min(kelly_full * kelly_fraction * bankroll, bankroll * max_exposure_pct)
            else:
                stake = 0.0
        else:
            stake = 0.0

        return Parlay(
            id=str(uuid.uuid4()),
            sport=sport,
            legs=legs,
            odds=round(combined_odds, 4),
            recommended_stake=round(stake, 2),
            expected_value=round(ev, 4),
            win_probability=round(combined_win_prob, 4),
        )


# ---------------------------------------------------------------------------
# Parlay optimizer
# ---------------------------------------------------------------------------


class ParlayOptimizer:
    """
    Generates optimized parlay candidates from a pool of bet legs.

    Candidate legs are combined exhaustively up to *max_legs*, filtered
    by *min_edge* (EV threshold), and ranked by expected value descending.

    For production, supply real legs via ``candidate_legs`` or override
    ``_fetch_legs()`` to pull from live odds feeds.
    """

    def __init__(
        self,
        risk_profile: str = "balanced",
        candidate_legs: list[Leg] | None = None,
        use_circadian: bool = True,
        **kwargs: Any,
    ):
        self.risk_profile = risk_profile
        self._candidate_legs: list[Leg] = candidate_legs or []
        self._builder = ParlayBuilder(use_circadian=use_circadian)
        logger.info(
            "ParlayOptimizer initialized | risk_profile=%s | circadian=%s | legs=%d",
            risk_profile, use_circadian, len(self._candidate_legs),
        )

    # ------------------------------------------------------------------
    # Kelly fraction by risk profile
    # ------------------------------------------------------------------

    @property
    def _kelly_fraction(self) -> float:
        return {"aggressive": 0.50, "balanced": 0.25, "conservative": 0.10}.get(
            self.risk_profile, 0.25
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_optimized_parlays(
        self,
        sports: list[str],
        min_edge: float = 0.05,
        max_legs: int = 3,
        bankroll: float = 1_000.0,
        top_n: int = 10,
    ) -> list[Parlay]:
        """
        Generate optimized parlay candidates.

        Parameters
        ----------
        sports:
            Sports to consider (legs are filtered to these sports).
        min_edge:
            Minimum EV threshold (parlays below this are discarded).
        max_legs:
            Maximum number of legs per parlay.
        bankroll:
            Current bankroll for stake sizing.
        top_n:
            Maximum number of parlays to return (ranked by EV).

        Returns
        -------
        List of :class:`Parlay` objects sorted by ``expected_value`` descending.
        """
        logger.info(
            "Generating parlays | sports=%s min_edge=%.3f max_legs=%d",
            sports, min_edge, max_legs,
        )

        legs = await self._fetch_legs(sports)
        if not legs:
            logger.info("No candidate legs available — returning empty list.")
            return []

        parlays: list[Parlay] = []
        for n_legs in range(1, max_legs + 1):
            for combo in itertools.combinations(legs, n_legs):
                try:
                    sport = combo[0].sport if hasattr(combo[0], "sport") else sports[0]
                    parlay = self._builder.build(
                        legs=list(combo),
                        sport=sport,
                        bankroll=bankroll,
                        kelly_fraction=self._kelly_fraction,
                    )
                    if parlay.expected_value >= min_edge and parlay.recommended_stake > 0:
                        parlays.append(parlay)
                except Exception:
                    logger.exception("Failed to build parlay from combo")

        parlays.sort(key=lambda p: p.expected_value, reverse=True)
        result = parlays[:top_n]
        logger.info("Optimizer found %d parlay candidates; returning top %d by EV", len(parlays), top_n)
        return result

    async def _fetch_legs(self, sports: list[str]) -> list[Leg]:
        """
        Fetch candidate legs for the given sports.

        Override this method to pull legs from live odds feeds.
        By default returns ``self._candidate_legs`` filtered by sport.
        """
        if not self._candidate_legs:
            return []
        sports_upper = {s.upper() for s in sports}
        return [
            leg for leg in self._candidate_legs
            if getattr(leg, "sport", sports[0]).upper() in sports_upper
        ]
