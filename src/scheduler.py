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
from src.brokers.oddsapi import OddsApiBroker
from src.brokers.base import SportsbookBroker
from src.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Broker routing helpers
# ---------------------------------------------------------------------------


def _build_brokers() -> dict[str, SportsbookBroker]:
    """
    Instantiate all brokers, injecting credentials from config.
    DraftKingsBroker raises ImportError if lukhed-sports is not installed;
    we catch that and omit it so the rest of the system still works.
    """
    brokers: dict[str, SportsbookBroker] = {}

    # PrizePicks -- always available (public odds endpoint works without auth)
    brokers["prizepicks"] = PrizePicksBroker(
        session_cookie=settings.PRIZEPICKS_SESSION_COOKIE or None,
        csrf_token=settings.PRIZEPICKS_CSRF_TOKEN or None,
    )

    # DraftKings -- requires lukhed-sports installed
    try:
        brokers["draftkings"] = DraftKingsBroker()
    except ImportError:
        logger.warning(
            "DraftKingsBroker unavailable (lukhed-sports not installed) -- skipping."
        )

    # The Odds API -- multi-book odds aggregation (read-only)
    if settings.THE_ODDS_API_KEY:
        try:
            brokers["oddsapi"] = OddsApiBroker(api_key=settings.THE_ODDS_API_KEY)
            logger.info("OddsApiBroker loaded (API key present).")
        except Exception:
            logger.exception("OddsApiBroker failed to initialise -- skipping.")
    else:
        logger.info("OddsApiBroker skipped -- THE_ODDS_API_KEY not set.")

    return brokers


def _select_broker(
    brokers: dict[str, SportsbookBroker], sport: str
) -> tuple[str, SportsbookBroker]:
    """
    Route a sport to the preferred broker.
    Priority:
      1. Odds API (multi-book aggregation, best for line shopping)
      2. DraftKings (game lines: spreads/totals/ML)
      3. PrizePicks (player props fallback)
    """
    game_line_sports = {"NFL", "NBA", "NHL", "MLB", "NCAAFB", "NCAAMB"}

    # Prefer Odds API for game-line sports (aggregates 40+ books)
    if sport.upper() in game_line_sports and "oddsapi" in brokers:
        return "oddsapi", brokers["oddsapi"]

    # Fallback to DraftKings for game lines
    if sport.upper() in game_line_sports and "draftkings" in brokers:
        return "draftkings", brokers["draftkings"]

    return "prizepicks", brokers["prizepicks"]


def validate_edge(parlay, current_odds: dict) -> bool:
    """
    Validate that a parlay still has positive expected value based on
    freshly-fetched live odds.

    Logic:
      For each leg in the parlay, look up the matching projection in
      current_odds.  If the live line has moved more than 10% against us
      (i.e. the line score has shifted unfavourably by >10%), invalidate.
      If no matching projection is found, we cannot confirm the edge --
      invalidate to be safe.

    Returns True only if every leg can be confirmed and none have moved
    significantly against us.
    """
    if not current_odds:
        logger.info("validate_edge: no current odds returned -- invalidating parlay.")
        return False

    if not hasattr(parlay, "legs") or not parlay.legs:
        # Single-event or unknown structure -- allow through if odds exist
        return True

    for leg in parlay.legs:
        event_id = getattr(leg, "event_id", None)
        if event_id is None:
            continue

        # Check by event_id first, then fall back to projection_id embedded in leg
        live = current_odds.get(str(event_id))
        if live is None:
            # Could not find this leg in freshly-fetched odds -- conservative: skip
            logger.info(
                "validate_edge: leg %s not found in live odds -- invalidating parlay %s.",
                event_id,
                getattr(parlay, "id", "?"),
            )
            return False

        # Compare original line to live line (PrizePicks projections use "line")
        original_line = float(getattr(leg, "line", 0) or 0)
        live_line = float(live.get("line", original_line) or original_line)

        if original_line != 0:
            shift = abs(live_line - original_line) / abs(original_line)
            if shift > 0.10:
                logger.info(
                    "validate_edge: leg %s line moved %.1f%% (%.2f -> %.2f) -- invalidating.",
                    event_id,
                    shift * 100,
                    original_line,
                    live_line,
                )
                return False

    return True


# ---------------------------------------------------------------------------
# Scheduled tasks
# ---------------------------------------------------------------------------


async def daily_bet_assessment(app) -> None:
    """
    Run once per day (default 09:00 local).
    1. Generate optimised parlays via ParlayOptimizer.
    2. Validate edge against live odds.
    3. Place top-N bets (capped by MAX_BETS_PER_DAY) and record them.
    """
    logger.info("=== Daily bet assessment starting ===")
    brokers = getattr(app.state, "brokers", None) or _build_brokers()
    risk_manager = app.state.risk_manager

    # Enforce stop-loss / cool-down before doing any work
    if risk_manager.check_stop_loss():
        logger.warning("Daily assessment aborted -- stop-loss/cool-down is active.")
        return

    from src.optimization.parlay_builder import ParlayOptimizer

    try:
        optimizer = ParlayOptimizer(
            risk_profile="balanced",
            brokers=brokers,
        )
        parlays = await optimizer.generate_optimized_parlays(
            sports=settings.ACTIVE_SPORTS,
            min_edge=settings.MIN_EDGE,
            max_legs=3,
            bankroll=risk_manager.bankroll,
        )
        logger.info("Optimizer returned %d parlay candidates", len(parlays))
    except Exception:
        logger.exception("Parlay optimiser failed")
        return

    placed = 0
    max_bets = settings.MAX_BETS_PER_DAY
    budget_manager = getattr(app.state, "budget_manager", None)

    for parlay in parlays[:max_bets]:  # cap at MAX_BETS_PER_DAY
        if placed >= max_bets:
            break

        # Re-check stop-loss and exposure before each bet
        if risk_manager.check_stop_loss():
            logger.warning(
                "Stop-loss triggered mid-session -- halting further placement."
            )
            break

        exposure = risk_manager.get_exposure()
        if exposure["exposure_pct"] >= risk_manager.max_exposure_pct * 100:
            logger.warning(
                "Exposure limit reached (%.1f%%) -- skipping remaining parlays.",
                exposure["exposure_pct"],
            )
            break

        broker_name, broker = _select_broker(brokers, parlay.sport)
        try:
            event_ids = [leg.event_id for leg in parlay.legs]
            current_odds = await broker.get_odds(parlay.sport, event_ids)

            if not validate_edge(parlay, current_odds):
                logger.info("Edge no longer valid for parlay %s, skipping", parlay.id)
                continue

            # Use Kelly criterion for stake sizing when win probability is available.
            # win_probability == 0.0 is the sentinel for "not provided by optimizer".
            if parlay.win_probability > 0:
                stake = risk_manager.kelly_stake(parlay.win_probability, parlay.odds)
                if stake == 0.0:
                    logger.info(
                        "Kelly stake is zero for parlay %s -- skipping", parlay.id
                    )
                    continue
            else:
                stake = parlay.recommended_stake

            # Cap stake to MAX_DAILY_STAKE from config
            stake = min(stake, settings.MAX_DAILY_STAKE)

            # Apply MIN_WIN_PROBABILITY gate from config
            if (
                parlay.win_probability > 0
                and parlay.win_probability < settings.MIN_WIN_PROBABILITY
            ):
                logger.info(
                    "Parlay %s win_prob=%.3f below MIN_WIN_PROBABILITY=%.3f -- skipping",
                    parlay.id,
                    parlay.win_probability,
                    settings.MIN_WIN_PROBABILITY,
                )
                continue

            # Check budget before placing
            if budget_manager is not None and not budget_manager.can_spend(
                stake, sport=parlay.sport
            ):
                logger.warning(
                    "Budget limit would be breached for parlay %s (stake=%.2f) -- skipping.",
                    parlay.id,
                    stake,
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
                budget_manager.record_spend(
                    bet_id, stake, sport=parlay.sport, sportsbook=broker_name
                )
            logger.info(
                "Placed bet %s via %s (parlay %s)", bet_id, broker_name, parlay.id
            )
            placed += 1

        except Exception:
            logger.exception("Failed to place parlay %s", getattr(parlay, "id", "?"))

    logger.info("=== Daily assessment complete -- %d bet(s) placed ===", placed)


async def resolve_bets(app) -> None:
    """
    Run hourly -- check pending bets and settle any that have results.
    """
    logger.info("Checking pending bets for settlement...")
    brokers = getattr(app.state, "brokers", None) or _build_brokers()

    try:
        pending = await app.state.risk_manager.get_pending_bets()
    except Exception:
        logger.exception("Could not fetch pending bets")
        return

    settled_count = 0
    for bet in pending:
        broker = brokers.get(bet.broker_name)
        if broker is None:
            logger.warning(
                "Unknown broker '%s' for bet %s", bet.broker_name, bet.bet_id
            )
            continue
        try:
            status = await broker.check_bet_status(bet.bet_id)
            if status.get("status") == "settled":
                result = status.get("result", "void")
                await app.state.risk_manager.settle_bet(bet.id, result)
                logger.info("Settled bet %s: result=%s", bet.bet_id, result)
                settled_count += 1
        except Exception:
            logger.exception("Error resolving bet %s", bet.bet_id)

    logger.info(
        "Bet resolution complete -- %d settled out of %d pending",
        settled_count,
        len(pending),
    )


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
        misfire_grace_time=300,  # allow up to 5 min late start
    )

    scheduler.add_job(
        resolve_bets,
        trigger="cron",
        minute=5,  # runs at HH:05 every hour
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
