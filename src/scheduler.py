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
    except Exception as e:
        logger.exception("Parlay optimiser failed")
        return

    placed = 0
    for parlay in parlays[:5]:           # cap at top 5 per day
        broker_name, broker = _select_broker(brokers, parlay.sport)
        try:
            event_ids = [leg.event_id for leg in parlay.legs]
            current_odds = await broker.get_odds(parlay.sport, event_ids)

            if not validate_edge(parlay, current_odds):
                logger.info(f"Edge no longer valid for parlay {parlay.id}, skipping")
                continue

            bet_id = await broker.place_bet(
                legs=[leg.__dict__ for leg in parlay.legs],
                stake=parlay.recommended_stake,
                odds=parlay.odds,
            )
            await app.state.risk_manager.record_bet(parlay, bet_id, broker_name)
            logger.info(f"Placed bet {bet_id} via {broker_name} (parlay {parlay.id})")
            placed += 1

        except Exception as e:
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
    except Exception as e:
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
        except Exception as e:
            logger.exception("Error resolving bet %s", bet.bet_id)

    logger.info(f"Bet resolution complete — {settled_count} settled out of {len(pending)} pending")


# ---------------------------------------------------------------------------
# Scheduler factory
# ---------------------------------------------------------------------------


def create_scheduler(app) -> AsyncIOScheduler:
    """
    Build and return a configured AsyncIOScheduler.
    Call scheduler.start() in your app lifespan, scheduler.shutdown() on teardown.

    Jobs:
        - daily_bet_assessment  -> every day at 09:00
        - resolve_bets          -> every hour at :05 past the hour
    """
    scheduler = AsyncIOScheduler()

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

    logger.info("Scheduler configured: daily_bet_assessment @ 09:00, resolve_bets @ *:05")
    return scheduler
