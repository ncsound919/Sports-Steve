import { useState } from "react";
import { GlassCard, StatCard } from "../components/ui/GlassCard";
import { useMode } from "../contexts/ModeContext";
import { useLocalSync } from "../hooks/useLocalSync";
import { steve } from "../api/client";

/* ---- Helpers -------------------------------------------------------- */

function betLabel(bet: { legs: Array<{ selection?: string; [key: string]: unknown }>; sport: string }): string {
  if (bet.legs && bet.legs.length > 0) {
    const first = bet.legs[0];
    if (first && first.selection) return first.selection;
  }
  return `${bet.sport} bet`;
}

function pnl(bet: { status: string; stake: number; odds: number }): number {
  if (bet.status === "won") return bet.stake * (bet.odds - 1);
  if (bet.status === "lost") return -bet.stake;
  return 0;
}

/* ---- Component ------------------------------------------------------ */

export default function Dashboard() {
  const { isBeginner } = useMode();
  const [isRunning, setIsRunning] = useState(false);
  const { bets, bankroll: stats, loading, offline, lastSynced } = useLocalSync(60_000);

  const recentBets = bets.slice(0, 5);

  const handleDailyRun = async () => {
    setIsRunning(true);
    try {
      await steve.triggerDailyRun();
    } catch {
      // Backend not running -- expected in standalone mode
    } finally {
      setTimeout(() => setIsRunning(false), 2000);
    }
  };

  // Streak: walk recent bets (newest first) to find the current run of won/lost.
  // Initial type is a placeholder; count === 0 means "no streak yet" — we set the
  // real type on the first resolved bet encountered.
  const streak = recentBets.reduce(
    (acc, b) => {
      if (!acc.done) {
        if (b.status === "pending") return acc;
        if (b.status === acc.type || acc.count === 0) {
          return { ...acc, type: b.status as "won" | "lost", count: acc.count + 1 };
        }
        return { ...acc, done: true };
      }
      return acc;
    },
    { type: "won" as "won" | "lost", count: 0, done: false },
  );

  const syncLabel = lastSynced
    ? `Last synced ${new Date(lastSynced).toLocaleTimeString()}`
    : null;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">
            {isBeginner ? "Welcome Back" : "Dashboard"}
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            {loading
              ? "Loading..."
              : offline
              ? "Offline -- showing your locally saved data"
              : isBeginner
              ? "Here's how your bets are doing today."
              : `${stats.exposure.open_bet_count} active bets | Kelly f* ${(stats.kelly_fraction * 100).toFixed(1)}%`}
          </p>
          {syncLabel && !loading && (
            <p className="text-[10px] text-text-muted mt-0.5">{syncLabel}</p>
          )}
        </div>
        <button
          onClick={handleDailyRun}
          disabled={isRunning}
          className="glass-sm px-5 py-2.5 text-sm font-medium text-win border border-win/20
                     hover:bg-win/10 hover:border-win/30 transition-all duration-200
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? "Analyzing..." : isBeginner ? "Find Bets" : "Run Daily Assessment"}
        </button>
      </div>

      {/* Offline banner */}
      {offline && !loading && (
        <div className="px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
          Backend is offline -- your data is safely stored on this device.
          {bets.length > 0 && ` Showing ${bets.length} locally cached bets.`}
        </div>
      )}

      {/* Local storage indicator */}
      {!loading && bets.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-win/5 border border-win/10 text-[10px] text-text-muted flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-win" />
          <span>
            Your data is stored locally on this device. {bets.length} bets saved.
            {offline ? " Working offline." : " Syncing with server."}
          </span>
        </div>
      )}

      {/* Stop-loss warning */}
      {stats.stop_loss_hit && (
        <div className="px-4 py-3 rounded-xl bg-loss/10 border border-loss/20 text-loss text-xs font-medium">
          Stop-loss triggered -- no new bets will be placed until tomorrow.
        </div>
      )}

      {/* Beginner Welcome Card */}
      {isBeginner && (
        <GlassCard className="border-win/10" glow="green">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div>
              <h3 className="font-semibold text-win mb-1">New to Betting?</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Sports Steve is an AI that finds the best bets for you using math and statistics. It
                only bets when it finds a genuine{" "}
                <strong className="text-white">edge</strong> -- meaning the real probability of
                winning is higher than what the odds suggest. Check out the{" "}
                <a href="/help" className="text-win underline underline-offset-2">
                  Help Center
                </a>{" "}
                to learn the basics.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={isBeginner ? "Today's Profit" : "Daily P&L"}
          value={`${stats.daily_pnl >= 0 ? "+" : ""}$${stats.daily_pnl.toFixed(2)}`}
          trend={stats.daily_pnl >= 0 ? "up" : "down"}
          tip="How much you've won or lost today"
          showTip={isBeginner}
        />
        <StatCard
          label={isBeginner ? "How Often You Win" : "Win Rate"}
          // Backend sends win_rate as a decimal fraction (e.g. 0.55 = 55%) — multiply by 100 for display.
          value={`${(stats.win_rate * 100).toFixed(1)}%`}
          subValue={`${stats.total_bets} total bets`}
          trend={stats.win_rate > 0.52 ? "up" : "down"}
          tip="Percentage of bets that won"
          showTip={isBeginner}
        />
        <StatCard
          label={isBeginner ? "Money Available" : "Bankroll"}
          value={`$${stats.bankroll.toFixed(2)}`}
          trend="neutral"
          tip="Total money available for betting"
          showTip={isBeginner}
        />
        <StatCard
          label={isBeginner ? "Current Streak" : "Streak"}
          value={streak.count > 0 ? `${streak.count}${streak.type === "won" ? "W" : "L"}` : "--"}
          // When count === 0 there is no streak yet — show neutral trend.
          trend={streak.count === 0 ? "neutral" : streak.type === "won" ? "up" : "down"}
          tip={`You've ${streak.type === "won" ? "won" : "lost"} ${streak.count} bets in a row`}
          showTip={isBeginner}
        />
      </div>

      {/* Expert-only: Extended Stats */}
      {!isBeginner && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="ROI"
            // Backend sends roi as a decimal fraction (e.g. 0.12 = 12%) — multiply by 100 for display.
            value={`${(stats.roi * 100).toFixed(1)}%`}
            trend={stats.roi >= 0 ? "up" : "down"}
          />
          <StatCard label="Avg Odds" value={stats.avg_odds.toFixed(2)} trend="neutral" />
          <StatCard
            label="Open Stake"
            value={`$${stats.exposure.total_open_stake.toFixed(2)}`}
            trend="neutral"
          />
          <StatCard
            label="Kelly Fraction"
            value={`${(stats.kelly_fraction * 100).toFixed(0)}%`}
            trend="neutral"
          />
        </div>
      )}

      {/* Risk Meter */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            {isBeginner ? "Safety Meter" : "Risk Exposure"}
          </h3>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              stats.exposure.exposure_pct < 30
                ? "text-win bg-win/10 border-win/20"
                : stats.exposure.exposure_pct < 70
                ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                : "text-loss bg-loss/10 border-loss/20"
            }`}
          >
            {stats.exposure.exposure_pct < 30
              ? "LOW RISK"
              : stats.exposure.exposure_pct < 70
              ? "MODERATE"
              : "HIGH RISK"}
          </span>
        </div>
        {isBeginner && (
          <p className="text-xs text-text-muted mb-3">
            This shows how much of your money is currently at risk. Green = safe, Red = be careful.
          </p>
        )}
        <div className="h-3 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              stats.exposure.exposure_pct < 30
                ? "bg-gradient-to-r from-win to-win-light"
                : stats.exposure.exposure_pct < 70
                ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                : "bg-gradient-to-r from-loss to-red-400"
            }`}
            style={{ width: `${Math.min(stats.exposure.exposure_pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-text-muted uppercase tracking-wider">
          <span>0%</span>
          <span>{stats.exposure.exposure_pct.toFixed(1)}% used</span>
          <span>100%</span>
        </div>
      </GlassCard>

      {/* Recent Bets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-display">
            {isBeginner ? "Your Recent Bets" : "Recent Activity"}
          </h2>
          <a href="/bets" className="text-xs text-text-muted hover:text-white transition-colors">
            View all →
          </a>
        </div>

        <div className="space-y-2">
          {recentBets.length === 0 && !loading && (
            <div className="text-center py-10 text-text-muted text-sm">
              No bets placed yet. Click &quot;{isBeginner ? "Find Bets" : "Run Daily Assessment"}&quot; to start.
            </div>
          )}
          {recentBets.map((bet) => {
            const betPnl = pnl(bet);
            return (
              <GlassCard key={bet.id} padding="sm" hover className="flex items-center gap-4">
                {/* Status Indicator */}
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    bet.status === "won"
                      ? "bg-win"
                      : bet.status === "lost"
                      ? "bg-loss"
                      : "bg-yellow-500 animate-glow-pulse"
                  }`}
                />

                {/* Event Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{betLabel(bet)}</p>
                  <p className="text-xs text-text-muted">
                    {bet.broker} · {bet.sport}
                  </p>
                </div>

                {/* Odds */}
                <div className="text-right">
                  <p className="text-sm font-mono text-text-secondary">{bet.odds.toFixed(2)}</p>
                  <p className="text-[10px] text-text-muted">${bet.stake.toFixed(2)} stake</p>
                </div>

                {/* P&L */}
                <div className="text-right w-20">
                  <p
                    className={`text-sm font-bold stat-value ${
                      bet.status === "won"
                        ? "text-win"
                        : bet.status === "lost"
                        ? "text-loss"
                        : "text-yellow-500"
                    }`}
                  >
                    {bet.status === "pending"
                      ? "Pending"
                      : `${betPnl >= 0 ? "+" : ""}$${betPnl.toFixed(2)}`}
                  </p>
                  <p className="text-[10px] text-text-muted uppercase">{bet.status}</p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Scheduler Status (Expert only) */}
      {!isBeginner && (
        <GlassCard padding="sm">
            <div className="flex items-center gap-6 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${offline ? "bg-loss" : "bg-win"}`} />
                <span>{offline ? "Backend offline" : "Scheduler active"}</span>
              </div>
              {/* NOTE: "Next assessment" and "Next resolution" are static display placeholders.
                  Real scheduler timing is managed server-side and not exposed via the API yet. */}
              <span>Next assessment: 09:00 AM</span>
              <span>Next resolution: :05 hourly</span>
            <span>Active sports: {offline ? "--" : "live"}</span>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
