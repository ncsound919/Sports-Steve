import { useState } from "react";
import { GlassCard } from "../components/ui/GlassCard";
import ExportMenu from "../components/ui/ExportMenu";
import { useMode } from "../contexts/ModeContext";
import { useLocalSync } from "../hooks/useLocalSync";

/* ---- Types ---------------------------------------------------------- */

type Filter = "all" | "pending" | "won" | "lost";

/* ---- Component ------------------------------------------------------ */

export default function BetHistory() {
  const { isBeginner } = useMode();
  const [filter, setFilter] = useState<Filter>("all");
  const { bets, loading, offline, lastSynced } = useLocalSync(30_000);

  const filtered =
    filter === "all" ? bets : bets.filter((b) => b.status === filter);

  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const pending = bets.filter((b) => b.status === "pending");

  // Summary stats computed over the FILTERED set so totals update when the tab changes.
  const filteredWon = filtered.filter((b) => b.status === "won");
  const filteredLost = filtered.filter((b) => b.status === "lost");
  const totalStaked = filtered.reduce((s, b) => s + b.stake, 0);
  // Guard odds <= 0 to avoid negative/infinite returns from bad data.
  const totalReturns = filteredWon.reduce(
    (s, b) => s + (b.odds > 0 ? b.stake * b.odds : 0),
    0,
  );
  const profit = totalReturns - totalStaked;
  const winRate =
    filteredWon.length + filteredLost.length > 0
      ? (filteredWon.length / (filteredWon.length + filteredLost.length)) * 100
      : 0;

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: bets.length },
    { id: "pending", label: "Pending", count: pending.length },
    { id: "won", label: "Won", count: won.length },
    { id: "lost", label: "Lost", count: lost.length },
  ];

  function betLabel(bet: { legs: Array<{ selection?: string; [key: string]: unknown }>; sport: string }): string {
    if (bet.legs && bet.legs.length > 0) {
      const first = bet.legs[0];
      if (first && first.selection) return first.selection;
    }
    return `${bet.sport} bet`;
  }

  function betPnl(bet: { status: string; stake: number; odds: number }): number {
    if (bet.status === "won") return bet.stake * (bet.odds - 1);
    if (bet.status === "lost") return -bet.stake;
    return 0;
  }

  // Prepare export data -- flatten for CSV/JSON export
  const exportData = filtered.map((bet) => ({
    id: bet.id,
    bet_id: bet.bet_id,
    broker: bet.broker,
    sport: bet.sport,
    selection: bet.legs?.[0]?.selection ?? '',
    stake: bet.stake,
    odds: bet.odds,
    expected_value: bet.expected_value,
    status: bet.status,
    result: bet.result ?? '',
    pnl: betPnl(bet),
    placed_at: bet.placed_at,
    settled_at: bet.settled_at ?? '',
    legs_count: bet.legs?.length ?? 0,
  }));

  const syncLabel = lastSynced
    ? `Synced ${new Date(lastSynced).toLocaleTimeString()}`
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">
            {isBeginner ? "My Bets" : "Bet History"}
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            {loading
              ? "Loading..."
              : offline
              ? "Offline -- showing locally saved bet history"
              : isBeginner
              ? "See all the bets you've placed and how they did."
              : `${bets.length} bets tracked | ${winRate.toFixed(1)}% win rate`}
          </p>
          {syncLabel && !loading && (
            <p className="text-[10px] text-text-muted mt-0.5">{syncLabel}</p>
          )}
        </div>
        <ExportMenu
          data={exportData}
          filename="bet-history"
          label={isBeginner ? "Save My Bets" : "Export"}
        />
      </div>

      {/* Offline banner */}
      {offline && !loading && (
        <div className="px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
          Backend is offline -- showing {bets.length} bets saved on this device.
        </div>
      )}

      {/* Local storage indicator */}
      {!loading && bets.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-win/5 border border-win/10 text-[10px] text-text-muted flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-win" />
          <span>
            All bet data is stored locally on your device. Use the Export button to download a copy anytime.
          </span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 text-center">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
            {isBeginner ? "Win Rate" : "Win %"}
          </p>
          <p className={`text-2xl font-bold stat-value ${winRate > 52 ? "text-win" : "text-loss"}`}>
            {winRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-text-muted mt-1">
            {filteredWon.length}W - {filteredLost.length}L
          </p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Staked</p>
          <p className="text-2xl font-bold stat-value text-white">${totalStaked.toFixed(2)}</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
            {isBeginner ? "Money Won" : "Returns"}
          </p>
          <p className="text-2xl font-bold stat-value text-win">${totalReturns.toFixed(2)}</p>
        </div>
        <div className={`glass p-4 text-center ${profit >= 0 ? "glow-green" : "glow-red"}`}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
            {isBeginner ? "Profit / Loss" : "Net P&L"}
          </p>
          <p className={`text-2xl font-bold stat-value ${profit >= 0 ? "text-win" : "text-loss"}`}>
            {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all
              ${
                filter === f.id
                  ? "bg-white/[0.08] text-white border border-border-glass-hover"
                  : "text-text-muted hover:text-white hover:bg-white/[0.03]"
              }`}
          >
            {f.label}
            <span className="ml-1.5 text-text-muted">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Bet List */}
      <div className="space-y-2">
        {loading && (
          <div className="text-center py-10 text-text-muted text-sm">Loading bets...</div>
        )}

        {!loading &&
          filtered.map((bet) => {
            const p = betPnl(bet);
            const isParlay = bet.legs && bet.legs.length > 1;
            return (
              <GlassCard key={bet.id} padding="sm" hover>
                <div className="flex items-center gap-4">
                  {/* Status */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      bet.status === "won"
                        ? "bg-win"
                        : bet.status === "lost"
                        ? "bg-loss"
                        : "bg-yellow-500 animate-glow-pulse"
                    }`}
                  />

                  {/* Event */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{betLabel(bet)}</p>
                      {isParlay && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-bold">
                          Parlay
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted">
                      {bet.broker} · {bet.sport}
                    </p>
                    {/* Parlay legs */}
                    {isParlay && (
                      <div className="mt-1.5 space-y-0.5">
                        {bet.legs.map((leg, i) => (
                          // Use selection as key if available for stability; fall back to index
                          <div key={leg.selection ?? i} className="flex items-center gap-2 text-[10px]">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                leg.status === "won"
                                  ? "bg-win"
                                  : leg.status === "lost"
                                  ? "bg-loss"
                                  : "bg-yellow-500"
                              }`}
                            />
                            <span className="text-text-muted">
                              {leg.selection ?? "leg"}
                            </span>
                            {leg.odds && (
                              <span className="text-text-muted font-mono">
                                {Number(leg.odds).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="text-right space-y-0.5">
                    <p className="text-xs text-text-muted">{bet.broker}</p>
                    <p className="text-xs font-mono text-text-secondary">{bet.odds.toFixed(2)}</p>
                    {!isBeginner && (
                      <p className="text-[10px] text-text-muted">
                        EV: {bet.expected_value >= 0 ? "+" : ""}
                        {(bet.expected_value * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>

                  {/* Stake & Return */}
                  <div className="text-right w-24">
                    <p className="text-xs text-text-muted">${bet.stake.toFixed(2)} stake</p>
                    <p
                      className={`text-sm font-bold stat-value ${
                        bet.status === "won"
                          ? "text-win"
                          : bet.status === "lost"
                          ? "text-loss"
                          : "text-yellow-500"
                      }`}
                    >
                      {bet.status === "won"
                        ? `+$${p.toFixed(2)}`
                        : bet.status === "lost"
                        ? `-$${bet.stake.toFixed(2)}`
                        : "Pending"}
                    </p>
                  </div>
                </div>
              </GlassCard>
            );
          })}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No bets match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
