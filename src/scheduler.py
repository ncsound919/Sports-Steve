"""
src/scheduler.py

Scheduled tasks for daily bet assessment and hourly bet resolution.
Attach to your FastAPI app lifespan or run standalone.

Usage (FastAPI lifespan):
    from src.scheduler import create_scheduler

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        scheduler = create_scheduler(app)
        scheduler.start()
        yield
        scheduler.shutdown()
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.brokers.draftkings import DraftKingsBroker
from src.brokers.prizepicks import PrizePicksBroker
from src.brokers.base import SportsbookBroker

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Broker routing helpers
# ---------------------------------------------------------------------------


def _build_brokers() -> dict[str, SportsbookBroker]:
    return {
        "draftkings": DraftKingsBroker(),
        "prizepicks": PrizePicksBroker(),
    }


def _select_broker(brokers: dict[str, SportsbookBroker], sport: str) -> tuple[str, SportsbookBroker]:
    """
    Route a sport to the preferred broker.
    - Game lines (spreads/totals/ML) -> DraftKings
    - Player props              -> PrizePicks
    Adjust this logic to fit your strategy.
    """
    game_line_sports = {"NFL", "NBA", "NHL", "MLB", "NCAAFB", "NCAAMB"}
    if sport.upper() in game_line_sports:
        return "draftkings", brokers["draftkings"]
    return "prizepicks", brokers["prizepicks"]


def validate_edge(parlay, current_odds: dict) -> bool:
    """
    Stub — replace with your real edge-validation logic.
    Return True if the parlay still has positive expected value
    based on freshly-fetched odds.
    """
    return bool(current_odds)  # placeholder: always valid if odds returned


# ---------------------------------------------------------------------------
# Scheduled tasks
# ---------------------------------------------------------------------------


async def daily_bet_assessment(app) -> None:
    """
    Run once per day (default 09:00 local).
    1. Generate optimised parlays via your ParlayOptimizer.
    2. Validate edge against live odds.
    3. Place top-N bets and record them in the DB.
    """
    logger.info("=== Daily bet assessment starting ===")
    brokers = _build_brokers()
    risk_manager = app.state.risk_manager

    # Enforce stop-loss / cool-down before doing any work
    if risk_manager.check_stop_loss():
        logger.warning("Daily assessment aborted — stop-loss/cool-down is active.")
        return

    # -- Import here to avoid circular deps at module load time --
    from src.optimization.parlay_builder import ParlayOptimizer
    from src.config import settings

    try:
        optimizer = ParlayOptimizer(
            risk_profile="balanced",
            # pass any other kwargs your optimizer needs
        )
        parlays = await optimizer.generate_optimized_parlays(
            sports=settings.ACTIVE_SPORTS,
            min_edge=0.05,
            max_legs=3,
        )
        logger.info(f"Optimizer returned {len(parlays)} parlay candidates")
    except Exception:
        logger.exception("Parlay optimiser failed")
        return

    placed = 0
    budget_manager = getattr(app.state, "budget_manager", None)

    for parlay in parlays[:5]:           # cap at top 5 per day
        # Re-check stop-loss and exposure before each bet
        if risk_manager.check_stop_loss():
            logger.warning("Stop-loss triggered mid-session — halting further placement.")
            break

        exposure = risk_manager.get_exposure()
        if exposure["exposure_pct"] >= risk_manager.max_exposure_pct * 100:
            logger.warning(
                "Exposure limit reached (%.1f%%) — skipping remaining parlays.",
                exposure["exposure_pct"],
            )
            break

        broker_name, broker = _select_broker(brokers, parlay.sport)
        try:
            event_ids = [leg.event_id for leg in parlay.legs]
            current_odds = await broker.get_odds(parlay.sport, event_ids)

            if not validate_edge(parlay, current_odds):
                logger.info(f"Edge no longer valid for parlay {parlay.id}, skipping")
                continue

            # Use Kelly criterion for stake sizing when win probability is available.
            # win_probability == 0.0 is the sentinel for "not provided by optimizer".
            if parlay.win_probability > 0:
                stake = risk_manager.kelly_stake(parlay.win_probability, parlay.odds)
                if stake == 0.0:
                    logger.info(f"Kelly stake is zero for parlay {parlay.id} — skipping")
                    continue
            else:
                stake = parlay.recommended_stake

            # Check budget before placing
            if budget_manager is not None and not budget_manager.can_spend(stake, sport=parlay.sport):
                logger.warning(
                    "Budget limit would be breached for parlay %s (stake=%.2f) — skipping.",
                    parlay.id, stake,
                )
                continue

            bet_id = await broker.place_bet(
                legs=[leg.__dict__ for leg in parlay.legs],
                stake=stake,
                odds=parlay.odds,
            )
            await risk_manager.record_bet(parlay, bet_id, broker_name)
            # Record spend in budget manager
            if budget_manager is not None:
                budget_manager.record_spend(bet_id, stake, sport=parlay.sport, sportsbook=broker_name)
            logger.info(f"Placed bet {bet_id} via {broker_name} (parlay {parlay.id})")
            placed += 1

        except Exception:
            logger.exception("Failed to place parlay %s", getattr(parlay, 'id', '?'))

    logger.info(f"=== Daily assessment complete — {placed} bet(s) placed ===")


async def resolve_bets(app) -> None:
    """
    Run hourly — check pending bets and settle any that have results.
    """
    logger.info("Checking pending bets for settlement...")
    brokers = _build_brokers()

    try:
        pending = await app.state.risk_manager.get_pending_bets()
    except Exception:
        logger.exception("Could not fetch pending bets")
        return

    settled_count = 0
    for bet in pending:
        broker = brokers.get(bet.broker_name)
        if broker is None:
            logger.warning(f"Unknown broker '{bet.broker_name}' for bet {bet.bet_id}")
            continue
        try:
            status = await broker.check_bet_status(bet.bet_id)
            if status.get("status") == "settled":
                await app.state.risk_manager.settle_bet(bet.id, status["result"])
                logger.info(f"Settled bet {bet.bet_id}: result={status['result']}")
                settled_count += 1
        except Exception:
            logger.exception("Error resolving bet %s", bet.bet_id)

    logger.info(f"Bet resolution complete — {settled_count} settled out of {len(pending)} pending")


async def reset_daily_limits(app) -> None:
    """Reset stop-loss and daily P&L at the start of each trading day (00:00)."""
    app.state.risk_manager.reset_daily_limits()
    logger.info("Daily risk limits reset.")


# ---------------------------------------------------------------------------
# Scheduler factory
# ---------------------------------------------------------------------------


def create_scheduler(app) -> AsyncIOScheduler:
    """
    Build and return a configured AsyncIOScheduler.
    Call scheduler.start() in your app lifespan, scheduler.shutdown() on teardown.

    Jobs:
        - reset_daily_limits    -> every day at 00:00
        - daily_bet_assessment  -> every day at 09:00
        - resolve_bets          -> every hour at :05 past the hour
    """
    scheduler = AsyncIOScheduler()

    scheduler.add_job(
        reset_daily_limits,
        trigger="cron",
        hour=0,
        minute=0,
        id="reset_daily_limits",
        args=[app],
        replace_existing=True,
        misfire_grace_time=300,
    )

    scheduler.add_job(
        daily_bet_assessment,
        trigger="cron",
        hour=9,
        minute=0,
        id="daily_bet_assessment",
        args=[app],
        replace_existing=True,
        misfire_grace_time=300,    # allow up to 5 min late start
    )

    scheduler.add_job(
        resolve_bets,
        trigger="cron",
        minute=5,                  # runs at HH:05 every hour
        id="resolve_bets",
        args=[app],
        replace_existing=True,
        misfire_grace_time=120,
    )

    logger.info(
        "Scheduler configured: reset_daily_limits @ 00:00, "
        "daily_bet_assessment @ 09:00, resolve_bets @ *:05"
    )
    return scheduler
