"""Tests for the historical dataset backtest engine."""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.services.dataset_backtest import (  # noqa: E402
    run_backtest,
    list_datasets,
    _us_to_decimal,
    _settle_spread,
    _settle_total,
    STRATEGIES,
)

HAS_DATASETS = bool(os.environ.get("SPORTS_DATASETS_DIR") or list_datasets())


@pytest.mark.skipif(not HAS_DATASETS, reason="datasets not present")
def test_backtest_runs_and_settles():
    """Each strategy should settle at least one bet and report a score."""
    for strategy in STRATEGIES:
        result = run_backtest(strategy, date_from="2015-01-01", date_to="2016-06-30", max_bets=200)
        assert result.settled > 0, f"{strategy} settled nothing"
        assert result.win_rate >= 0.0
        assert result.settled == result.wins + result.losses + result.pushes


@pytest.mark.skipif(not HAS_DATASETS, reason="datasets not present")
def test_totals_under_is_positive_in_window():
    """Known result: totals-under is profitable in the 2015-16 window."""
    result = run_backtest("totals_under", date_from="2015-01-01", date_to="2016-06-30", max_bets=3000)
    assert result.roi_pct > 0


def test_us_to_decimal():
    assert _us_to_decimal(-110) == pytest.approx(1.909, rel=0.01)
    assert _us_to_decimal(100) == 2.0
    assert _us_to_decimal(110) == pytest.approx(2.10, rel=0.01)


def test_settle_spread_logic():
    game = {"home_team": "A", "away_team": "B", "home_pts": 100, "away_pts": 95}
    assert _settle_spread(game, "A", -3) == "win"    # 100 - 3 > 95
    assert _settle_spread(game, "A", -6) == "loss"   # 100 - 6 < 95
    assert _settle_spread(game, "A", -5) == "push"   # 100 - 5 == 95


def test_settle_total_logic():
    game = {"home_pts": 100, "away_pts": 95}
    assert _settle_total(game, 200, "over") == "loss"
    assert _settle_total(game, 190, "over") == "win"
    assert _settle_total(game, 195, "under") == "push"
