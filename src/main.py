"""
src/main.py  -- FastAPI app with scheduler wired into lifespan.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, APIRouter, BackgroundTasks, Depends, HTTPException, Request
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache

from src.config import settings
from src.database import get_connection, init_db
from src.risk_manager import RiskManager
from src.scheduler import create_scheduler
from src.account_tracker import AccountTracker
from src.budget import BudgetManager, BudgetPeriod

import secrets as _secrets_mod

async def verify_api_key(request: Request):
    """Verify API key if configured."""
    api_key = settings.SPORTS_STEVE_API_KEY
    if settings.ENV == "development" and not api_key:
        return
    if not api_key:
        raise HTTPException(status_code=503, detail="API key is not configured")
    auth = request.headers.get("Authorization", "")
    expected = f"Bearer {api_key}"
    if not _secrets_mod.compare_digest(auth, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


# Configure logging using level from .env
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_daily_run_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- startup ----
    if settings.ENV != "development" and not settings.SPORTS_STEVE_API_KEY:
        raise RuntimeError("SPORTS_STEVE_API_KEY must be configured outside development")

    # Initialise SQLite database
    db_conn = get_connection()
    init_db(db_conn)
    app.state.db_conn = db_conn
    app.state.settings_lock = asyncio.Lock()

    app.state.risk_manager = RiskManager(
        bankroll=settings.RISK_BANKROLL,
        max_daily_loss_pct=settings.RISK_MAX_DAILY_LOSS_PCT,
        max_exposure_pct=settings.RISK_MAX_EXPOSURE_PCT,
        kelly_fraction=settings.RISK_KELLY_FRACTION,
        db_conn=db_conn,
    )

    # Multi-sportsbook account tracker -- register known accounts at startup
    tracker = AccountTracker(db_conn=db_conn)
    # Only add default accounts if they don't already exist from DB
    if tracker.get_account("prizepicks-main") is None and settings.RISK_BANKROLL > 0:
        tracker.add_account(
            "PrizePicks",
            initial_balance=settings.RISK_BANKROLL,
            account_id="prizepicks-main",
        )
    if tracker.get_account("draftkings-main") is None:
        # DraftKings balance is unknown at startup -- register with 0 and update manually
        tracker.add_account(
            "DraftKings", initial_balance=0.0, account_id="draftkings-main"
        )
    app.state.account_tracker = tracker

    # Budget manager -- wire up any non-zero limits from config
    budget_manager = BudgetManager(db_conn=db_conn)
    if settings.BUDGET_DAILY_LIMIT > 0:
        budget_manager.add_budget(BudgetPeriod.DAILY, settings.BUDGET_DAILY_LIMIT)
    if settings.BUDGET_WEEKLY_LIMIT > 0:
        budget_manager.add_budget(BudgetPeriod.WEEKLY, settings.BUDGET_WEEKLY_LIMIT)
    if settings.BUDGET_MONTHLY_LIMIT > 0:
        budget_manager.add_budget(BudgetPeriod.MONTHLY, settings.BUDGET_MONTHLY_LIMIT)
    app.state.budget_manager = budget_manager

    from src.scheduler import _build_brokers

    app.state.brokers = _build_brokers()

    scheduler = create_scheduler(app)
    scheduler.start()
    logger.info("APScheduler started")

    # Initialize in-memory cache for picks endpoint
    FastAPICache.init(InMemoryBackend(), prefix="sports-steve-cache")
    logger.info("FastAPICache initialized")

    yield  # app is running

    # ---- shutdown ----
    scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped")
    for name, broker in app.state.brokers.items():
        if hasattr(broker, "aclose"):
            try:
                await broker.aclose()
            except Exception:
                logger.warning("Failed to close broker %s", name, exc_info=True)
    # Flush and close the database connection
    db_conn.close()
    logger.info("SQLite connection closed")


app = FastAPI(
    title="Sports Steve",
    version="1.1.0",
    lifespan=lifespan,
    dependencies=[Depends(verify_api_key)],
)

# Allow the Vite dev server (and any origin in dev) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/v1", tags=["sports-steve"])


# ---------------------------------------------------------------------------
# Trigger endpoints (POST)
# ---------------------------------------------------------------------------


@router.post("/daily-run", summary="Manually trigger the daily bet assessment")
async def trigger_daily_run(background_tasks: BackgroundTasks):
    if _daily_run_lock.locked():
        raise HTTPException(status_code=409, detail="Daily run already in progress")
    from src.scheduler import daily_bet_assessment

    async def _locked_daily_run(app_ref):
        async with _daily_run_lock:
            await daily_bet_assessment(app_ref)

    background_tasks.add_task(_locked_daily_run, app)
    return {"status": "queued", "job": "daily_bet_assessment"}


@router.post("/resolve-bets", summary="Manually trigger bet resolution")
async def trigger_resolve_bets(background_tasks: BackgroundTasks):
    from src.scheduler import resolve_bets

    background_tasks.add_task(resolve_bets, app)
    return {"status": "queued", "job": "resolve_bets"}


# ---------------------------------------------------------------------------
# Read endpoints (GET) -- used by the frontend
# ---------------------------------------------------------------------------


@router.get("/health", summary="Health check and scheduler status")
async def health():
    return {
        "status": "ok",
        "scheduler_running": True,
        "active_sports": settings.ACTIVE_SPORTS,
        "bankroll": app.state.risk_manager.bankroll,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_version": "1.1.0",
    }


@router.get("/bankroll", summary="Current bankroll and risk state")
async def get_bankroll():
    rm = app.state.risk_manager
    exposure = rm.get_exposure()
    bets = await rm.get_all_bets()
    won = [b for b in bets if b.status == "won"]
    lost = [b for b in bets if b.status == "lost"]
    total_bets = len(bets)
    win_rate = len(won) / (len(won) + len(lost)) if (won or lost) else 0.0
    avg_odds = (sum(b.odds for b in bets) / total_bets) if total_bets else 0.0
    total_staked = sum(b.stake for b in bets)
    total_returns = sum(b.stake * b.odds for b in won)
    roi = ((total_returns - total_staked) / total_staked) if total_staked > 0 else 0.0

    return {
        "bankroll": round(rm.bankroll, 2),
        "daily_pnl": round(rm.daily_pnl, 2),
        "win_rate": round(win_rate, 4),
        "total_bets": total_bets,
        "avg_odds": round(avg_odds, 4),
        "roi": round(roi, 4),
        "kelly_fraction": rm.kelly_fraction,
        "max_daily_stake": settings.MAX_DAILY_STAKE,
        "stop_loss_hit": rm.is_cooling_down,
        "exposure": exposure,
    }


@router.get("/bets", summary="All bet history")
async def get_bets():
    rm = app.state.risk_manager
    bets = await rm.get_all_bets()
    return {
        "bets": [
            {
                "id": b.id,
                "bet_id": b.bet_id,
                "broker": b.broker_name,
                "sport": b.sport,
                "legs": b.legs,
                "stake": b.stake,
                "odds": b.odds,
                "expected_value": b.expected_value,
                "status": b.status,
                "result": b.result,
                "placed_at": b.placed_at.isoformat(),
                "settled_at": b.settled_at.isoformat() if b.settled_at else None,
            }
            for b in sorted(bets, key=lambda x: x.placed_at, reverse=True)
        ],
        "count": len(bets),
    }


@router.get("/bets/pending", summary="Pending bets only")
async def get_pending_bets():
    rm = app.state.risk_manager
    pending = await rm.get_pending_bets()
    return {
        "bets": [
            {
                "id": b.id,
                "bet_id": b.bet_id,
                "broker": b.broker_name,
                "sport": b.sport,
                "stake": b.stake,
                "odds": b.odds,
                "placed_at": b.placed_at.isoformat(),
            }
            for b in pending
        ],
        "count": len(pending),
    }


@router.get("/exposure", summary="Current risk exposure")
async def get_exposure():
    return app.state.risk_manager.get_exposure()


@router.get("/accounts", summary="Sportsbook account summary")
async def get_accounts():
    tracker = app.state.account_tracker
    return {
        "accounts": tracker.account_summary(),
        "total_balance": tracker.total_balance(),
        "health_flags": tracker.health_report(),
    }


@router.get("/budget", summary="Budget usage for current period")
async def get_budget():
    bm = app.state.budget_manager
    return {
        "budgets": bm.summary(),
        "has_budgets": len(bm._budgets) > 0,
    }


class SettingsUpdate(BaseModel):
    daily_limit: Optional[float] = Field(None, gt=0, le=10000)
    weekly_limit: Optional[float] = Field(None, gt=0, le=50000)
    monthly_limit: Optional[float] = Field(None, gt=0, le=200000)
    kelly_fraction: Optional[float] = Field(None, gt=0, le=0.5)
    max_daily_stake: Optional[float] = Field(None, gt=0, le=100)


@router.post(
    "/settings", summary="Update runtime settings (budget limits and risk profile)"
)
async def update_settings(body: SettingsUpdate):
    """
    Accepts a JSON body with any of:
      daily_limit, weekly_limit, monthly_limit (float, USD)
      kelly_fraction (float, 0-1)
      max_daily_stake (float, USD)

    Updates the in-memory state. NOTE: these changes do not persist across
    restarts -- update your .env for permanent changes.
    """
    bm = app.state.budget_manager
    rm = app.state.risk_manager

    applied = []
    if body.daily_limit is not None:
        bm.add_budget(BudgetPeriod.DAILY, body.daily_limit)
        applied.append("daily_limit")
    if body.weekly_limit is not None:
        bm.add_budget(BudgetPeriod.WEEKLY, body.weekly_limit)
        applied.append("weekly_limit")
    if body.monthly_limit is not None:
        bm.add_budget(BudgetPeriod.MONTHLY, body.monthly_limit)
        applied.append("monthly_limit")
    if body.kelly_fraction is not None or body.max_daily_stake is not None:
        async with app.state.settings_lock:
            if body.kelly_fraction is not None:
                rm.kelly_fraction = body.kelly_fraction
                applied.append("kelly_fraction")
            if body.max_daily_stake is not None:
                settings.MAX_DAILY_STAKE = body.max_daily_stake
                applied.append("max_daily_stake")

    return {"status": "updated", "applied": applied}

# Cache picks for 60 seconds (prevents rate limiting by caching PP responses)
@router.get("/prizepicks/picks", summary="PrizePicks matched picks with edge analysis")
@cache(expire=60)
async def get_prize_picks_picks(
    sport: str | None = None,  # query param for filtering
    min_edge: float = 0.0,
):
    """
    Returns PrizePicks projections matched to Odds API lines.

    Query params:
      - sport: Filter by sport (e.g., NBA, NFL) — optional
      - min_edge: Minimum edge threshold (0.05 = 5%) — default 0

    Returns list of matched picks sorted by edge descending.
    Cached for 60 seconds to prevent rate limiting.
    """
    if sport and sport.strip():
        sports = [sport]
    else:
        sports = settings.ACTIVE_SPORTS

    brokers = app.state.brokers

    if not brokers:
        return {"picks": [], "error": "No brokers available"}

    from src.services.picks_matcher import PicksMatcher

    matcher = PicksMatcher(brokers=brokers)

    # Use async context to ensure proper cleanup
    try:
        picks = await matcher.fetch_picks(sports=sports, min_edge=min_edge)
        return {
            "picks": [
                {
                    "player": p.player,
                    "stat_type": p.stat_type,
                    "pp_line": p.pp_line,
                    "odds": p.odds,
                    "pp_projection_id": p.pp_projection_id,
                    "game_id": p.game_id,
                    "oddsapi_home": p.oddsapi_home,
                    "oddsapi_away": p.oddsapi_away,
                    "oddsapi_line": p.oddsapi_line,
                    "edge": p.edge,
                    "sport": p.sport,
                }
                for p in picks
            ],
            "count": len(picks),
        }
    except Exception:
        logger.exception("Failed to fetch PrizePicks picks")
        return {"picks": [], "error": "Failed to fetch picks"}


app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
