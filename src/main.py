"""
src/main.py  — FastAPI app with scheduler wired into lifespan.
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, APIRouter, BackgroundTasks

from src.risk_manager import RiskManager
from src.scheduler import create_scheduler
from src.config import settings
from src.account_tracker import AccountTracker
from src.budget import BudgetManager, BudgetPeriod

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- startup ----
    app.state.risk_manager = RiskManager(
        bankroll=settings.RISK_BANKROLL,
        max_daily_loss_pct=settings.RISK_MAX_DAILY_LOSS_PCT,
        max_exposure_pct=settings.RISK_MAX_EXPOSURE_PCT,
        kelly_fraction=settings.RISK_KELLY_FRACTION,
    )

    # Multi-sportsbook account tracker
    app.state.account_tracker = AccountTracker()

    # Budget manager — wire up any non-zero limits from config
    budget_manager = BudgetManager()
    if settings.BUDGET_DAILY_LIMIT > 0:
        budget_manager.add_budget(BudgetPeriod.DAILY, settings.BUDGET_DAILY_LIMIT)
    if settings.BUDGET_WEEKLY_LIMIT > 0:
        budget_manager.add_budget(BudgetPeriod.WEEKLY, settings.BUDGET_WEEKLY_LIMIT)
    if settings.BUDGET_MONTHLY_LIMIT > 0:
        budget_manager.add_budget(BudgetPeriod.MONTHLY, settings.BUDGET_MONTHLY_LIMIT)
    app.state.budget_manager = budget_manager

    scheduler = create_scheduler(app)
    scheduler.start()
    logger.info("APScheduler started")

    yield  # app is running

    # ---- shutdown ----
    scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped")


app = FastAPI(lifespan=lifespan)


# ---------------------------------------------------------------------------
# Optional: manual trigger endpoint for testing / CI
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/v1", tags=["scheduler"])


@router.post("/daily-run", summary="Manually trigger the daily bet assessment")
async def trigger_daily_run(background_tasks: BackgroundTasks):
    from src.scheduler import daily_bet_assessment
    background_tasks.add_task(daily_bet_assessment, app)
    return {"status": "queued", "job": "daily_bet_assessment"}


@router.post("/resolve-bets", summary="Manually trigger bet resolution")
async def trigger_resolve_bets(background_tasks: BackgroundTasks):
    from src.scheduler import resolve_bets
    background_tasks.add_task(resolve_bets, app)
    return {"status": "queued", "job": "resolve_bets"}


app.include_router(router)
