"""
dataset_backtest.py — backtest betting theories against historical NBA data.

Consumes the deterministic-brain sports datasets (CSV):
  - nba_games_all.csv        team/player game logs (pts, wl, team_id, a_team_id)
  - nba_betting_spread.csv   point spreads per book (spread1/2, price1/2, US odds)
  - nba_betting_totals.csv   over/under lines per book (total1/2, price1/2)
  - nba_detailed_odds.csv    money-line / market odds (decimal)

Deterministic: every simulated bet settles against the recorded final score.
No LLM, no live odds — pure backtesting on historical ground truth.
"""
from __future__ import annotations

import csv
import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Callable, Optional

# Candidate dataset locations (resolved in order). Override with SPORTS_DATASETS_DIR.
def _find_datasets_dir() -> str:
    env = os.environ.get("SPORTS_DATASETS_DIR", "")
    if env and Path(env).exists():
        return env
    # Walk up from this module looking for integrations/deterministic-brain/datasets.
    here = Path(__file__).resolve().parent
    for parent in [here, *here.parents]:
        candidate = parent / "integrations" / "deterministic-brain" / "datasets"
        if candidate.exists():
            return str(candidate)
    return ""

DATASETS_DIR = _find_datasets_dir()

GAMES_FILE = "nba_games_all.csv"
SPREAD_FILE = "nba_betting_spread.csv"
TOTALS_FILE = "nba_betting_totals.csv"
ML_FILE = "nba_detailed_odds.csv"


@dataclass
class BacktestBet:
    game_id: str
    game_date: str
    matchup: str
    selection: str          # e.g. "team_id-1610612762", "over", "under"
    line: float             # spread or total line (0 for ML)
    odds: float             # decimal odds used
    stake: float
    outcome: str            # "win" | "loss" | "push"
    profit: float           # +payout - stake for a win, -stake for a loss
    points: dict = field(default_factory=dict)


@dataclass
class BacktestResult:
    strategy: str
    params: dict
    bets_placed: int
    settled: int
    wins: int
    losses: int
    pushes: int
    win_rate: float            # wins / settled (excl pushes)
    total_staked: float
    total_returned: float
    profit: float
    roi_pct: float
    avg_odds: float
    by_season: dict = field(default_factory=dict)
    sample_bets: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def _rows(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def games_index() -> dict[str, dict]:
    """game_id -> {home_team, away_team, home_pts, away_pts, home_wl, date, matchup}."""
    index: dict[str, dict] = {}
    for row in _rows(os.path.join(DATASETS_DIR, GAMES_FILE)):
        game_id = row.get("game_id", "").strip()
        if not game_id:
            continue
        team_id = row.get("team_id", "")
        opponent = row.get("a_team_id", "")
        is_home = row.get("is_home", "").strip().lower() == "t"
        pts = _f(row.get("pts"))
        wl = row.get("wl", "").strip()
        entry = index.setdefault(game_id, {
            "home_team": None, "away_team": None,
            "home_pts": None, "away_pts": None,
            "home_wl": None, "date": row.get("game_date", "").strip(),
            "matchup": row.get("matchup", "").strip(),
        })
        if is_home:
            entry["home_team"] = team_id
            entry["home_pts"] = pts
            entry["home_wl"] = wl
        else:
            entry["away_team"] = team_id
            entry["away_pts"] = pts
    return index


def _us_to_decimal(us: float) -> float:
    """Convert US odds (+110 -> 2.10, -110 -> 1.909) to decimal."""
    if us > 0:
        return 1.0 + us / 100.0
    if us < 0:
        return 1.0 + 100.0 / abs(us)
    return 1.0


def load_spreads() -> list[dict]:
    rows = []
    for row in _rows(os.path.join(DATASETS_DIR, SPREAD_FILE)):
        try:
            rows.append({
                "game_id": row["game_id"].strip(),
                "team_id": row["team_id"].strip(),
                "a_team_id": row["a_team_id"].strip(),
                "spread": _f(row.get("spread1")),
                "price_us": _f(row.get("price1")),
                "price2_us": _f(row.get("price2")),
                "book": row.get("book_name", "").strip(),
            })
        except (KeyError, ValueError):
            continue
    return rows


def load_totals() -> list[dict]:
    rows = []
    for row in _rows(os.path.join(DATASETS_DIR, TOTALS_FILE)):
        try:
            rows.append({
                "game_id": row["game_id"].strip(),
                "team_id": row["team_id"].strip(),
                "a_team_id": row["a_team_id"].strip(),
                "total": _f(row.get("total1")),
                "price_us": _f(row.get("price1")),
                "book": row.get("book_name", "").strip(),
            })
        except (KeyError, ValueError):
            continue
    return rows


def _f(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Settlement
# ---------------------------------------------------------------------------

def _settle_spread(game: dict, team_id: str, spread: float, pts: Optional[float] = None) -> str:
    """team_id covers when (team_pts + spread) > opp_pts."""
    if not game or game["home_pts"] is None or game["away_pts"] is None:
        return "unsettled"
    team_pts = pts if pts is not None else _team_pts(game, team_id)
    opp_pts = _opp_pts(game, team_id)
    if team_pts is None or opp_pts is None:
        return "unsettled"
    margin = (team_pts + spread) - opp_pts
    if abs(margin) < 0.01:
        return "push"
    return "win" if margin > 0 else "loss"


def _settle_total(game: dict, total: float, pick: str) -> str:
    if not game or game["home_pts"] is None or game["away_pts"] is None:
        return "unsettled"
    combined = game["home_pts"] + game["away_pts"]
    margin = combined - total
    if abs(margin) < 0.01:
        return "push"
    if pick == "over":
        return "win" if margin > 0 else "loss"
    return "win" if margin < 0 else "loss"


def _settle_ml(game: dict, team_id: str) -> str:
    if not game or game["home_pts"] is None or game["away_pts"] is None:
        return "unsettled"
    team_pts = _team_pts(game, team_id)
    opp_pts = _opp_pts(game, team_id)
    if team_pts is None or opp_pts is None:
        return "unsettled"
    if team_pts == opp_pts:
        return "push"
    return "win" if team_pts > opp_pts else "loss"


def _team_pts(game: dict, team_id: str) -> Optional[float]:
    if game["home_team"] == team_id:
        return game["home_pts"]
    if game["away_team"] == team_id:
        return game["away_pts"]
    return None


def _opp_pts(game: dict, team_id: str) -> Optional[float]:
    if game["home_team"] == team_id:
        return game["away_pts"]
    if game["away_team"] == team_id:
        return game["home_pts"]
    return None


# ---------------------------------------------------------------------------
# Backtest engine
# ---------------------------------------------------------------------------

def _to_american(odds: float) -> str:
    if odds >= 2.0:
        return f"+{round((odds - 1) * 100)}"
    return f"{round(-100 / (odds - 1))}"


def run_backtest(
    strategy: str,
    params: Optional[dict] = None,
    date_from: str = "",
    date_to: str = "",
    stake: float = 10.0,
    max_bets: int = 5000,
    books: Optional[list[str]] = None,
) -> BacktestResult:
    """Run a deterministic strategy backtest over the dataset.

    Strategies:
      spread_favorite  — back the favorite (negative spread) at closing price
      spread_home      — back the home team against the spread
      spread_underdog  — back the underdog (+spread)
      totals_over      — bet over the closing total
      totals_under     — bet under the closing total
      ml_favorite      — money-line favorite (from detailed odds Market)
      ml_underdog      — money-line underdog
    """
    params = params or {}
    index = games_index()
    bets: list[BacktestBet] = []

    if strategy in ("spread_favorite", "spread_home", "spread_underdog"):
        for row in load_spreads():
            if books and row["book"] not in books:
                continue
            game = index.get(row["game_id"])
            if not game:
                continue
            if date_from and game["date"] < date_from:
                continue
            if date_to and game["date"] > date_to:
                continue
            if row["spread"] is None or row["price_us"] is None:
                continue
            pick_team = row["team_id"]
            if strategy == "spread_favorite" and row["spread"] >= 0:
                continue
            if strategy == "spread_underdog" and row["spread"] <= 0:
                continue
            if strategy == "spread_home":
                # Bet the home side regardless of whether the CSV lists it as
                # team_id (spread1/price1) or a_team_id (mirror side).
                if game["home_team"] == row["team_id"]:
                    pick_team, spread_used, price_us = row["team_id"], row["spread"], row["price_us"]
                elif game["home_team"] == row["a_team_id"]:
                    pick_team = row["a_team_id"]
                    spread_used = -row["spread"] if row["spread"] is not None else None
                    price_us = row["price2_us"]
                else:
                    continue
            else:
                pick_team, spread_used, price_us = row["team_id"], row["spread"], row["price_us"]
            if spread_used is None or price_us is None:
                continue
            odds = _us_to_decimal(price_us)
            outcome = _settle_spread(game, pick_team, spread_used)
            if outcome == "unsettled":
                continue
            payout = stake * odds if outcome == "win" else (stake if outcome == "push" else 0.0)
            bets.append(BacktestBet(
                game_id=row["game_id"], game_date=game["date"],
                matchup=game["matchup"],
                selection=f"{pick_team} ({_to_american(odds)})",
                line=spread_used, odds=odds, stake=stake,
                outcome=outcome, profit=payout - stake,
                points={"team": _team_pts(game, pick_team), "opp": _opp_pts(game, pick_team)},
            ))
    elif strategy in ("totals_over", "totals_under"):
        pick = strategy.replace("totals_", "")
        for row in load_totals():
            if books and row["book"] not in books:
                continue
            game = index.get(row["game_id"])
            if not game:
                continue
            if date_from and game["date"] < date_from:
                continue
            if date_to and game["date"] > date_to:
                continue
            if row["total"] is None or row["price_us"] is None:
                continue
            odds = _us_to_decimal(row["price_us"])
            outcome = _settle_total(game, row["total"], pick)
            if outcome == "unsettled":
                continue
            payout = stake * odds if outcome == "win" else (stake if outcome == "push" else 0.0)
            bets.append(BacktestBet(
                game_id=row["game_id"], game_date=game["date"],
                matchup=game["matchup"], selection=pick,
                line=row["total"], odds=odds, stake=stake,
                outcome=outcome, profit=payout - stake,
                points={"total": game["home_pts"] + game["away_pts"]},
            ))
    elif strategy in ("ml_favorite", "ml_underdog"):
        # The detailed-odds file is a separate 2025 demo feed (full team names)
        # that does NOT correspond to the 2009-2018 games/spread data (team IDs).
        # Money-line backtests are therefore not derivable from this dataset —
        # refuse loudly rather than fabricate a result.
        raise ValueError(
            "ml_favorite/ml_underdog require a money-line odds feed aligned to the "
            "games dataset; nba_detailed_odds.csv is a non-matching 2025 demo feed."
        )
    else:
        raise ValueError(f"unknown strategy: {strategy}")

    bets = bets[:max_bets]
    settled = [b for b in bets if b.outcome != "unsettled"]
    wins = sum(1 for b in settled if b.outcome == "win")
    losses = sum(1 for b in settled if b.outcome == "loss")
    pushes = sum(1 for b in settled if b.outcome == "push")
    settled_decided = wins + losses
    total_staked = sum(b.stake for b in settled)
    total_returned = sum(b.stake + b.profit for b in settled)
    profit = sum(b.profit for b in settled)
    by_season: dict[str, dict] = {}
    for b in settled:
        season = b.game_date[:4]
        agg = by_season.setdefault(season, {"bets": 0, "profit": 0.0, "wins": 0})
        agg["bets"] += 1
        agg["profit"] += b.profit
        if b.outcome == "win":
            agg["wins"] += 1

    return BacktestResult(
        strategy=strategy,
        params={**params, "date_from": date_from, "date_to": date_to, "stake": stake},
        bets_placed=len(bets),
        settled=len(settled),
        wins=wins, losses=losses, pushes=pushes,
        win_rate=round(wins / settled_decided * 100, 2) if settled_decided else 0.0,
        total_staked=round(total_staked, 2),
        total_returned=round(total_returned, 2),
        profit=round(profit, 2),
        roi_pct=round(profit / total_staked * 100, 2) if total_staked else 0.0,
        avg_odds=round(sum(b.odds for b in settled) / len(settled), 3) if settled else 0.0,
        by_season={s: {"bets": v["bets"], "wins": v["wins"], "profit": round(v["profit"], 2)}
                   for s, v in by_season.items()},
        sample_bets=[asdict(b) for b in settled[:8]],
    )


def list_datasets() -> list[dict]:
    """Describe available datasets for the UI."""
    if not DATASETS_DIR:
        return [{"error": "datasets not found — set SPORTS_DATASETS_DIR"}]
    out = []
    for fname, label in [
        (GAMES_FILE, "NBA team/player game logs"),
        (SPREAD_FILE, "NBA point spreads by book"),
        (TOTALS_FILE, "NBA over/under totals by book"),
        (ML_FILE, "NBA money-line / market odds"),
    ]:
        path = os.path.join(DATASETS_DIR, fname)
        if os.path.exists(path):
            with open(path, newline="", encoding="utf-8-sig") as f:
                count = sum(1 for _ in f) - 1
            out.append({"file": fname, "label": label, "rows": count, "path": path})
    return out


STRATEGIES = [
    "spread_favorite", "spread_home", "spread_underdog",
    "totals_over", "totals_under",
]
