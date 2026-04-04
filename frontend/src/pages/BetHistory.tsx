import { useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useMode } from '../contexts/ModeContext';
import type { Bet, BetStatus } from '../types';

/* ─── Mock Data ──────────────────────────────────────── */

const MOCK_BETS: Bet[] = [
  { id: '1', sport: 'NBA', event: 'Lakers vs Celtics', selection: 'Lakers ML', odds: 2.45, oddsFormat: 'decimal', stake: 1.50, potentialReturn: 3.68, status: 'won', placedAt: '2026-04-03T14:30:00Z', resolvedAt: '2026-04-03T22:00:00Z', sportsbook: 'DraftKings', isParlay: false },
  { id: '2', sport: 'NBA', event: 'Warriors vs Bucks', selection: 'Over 224.5', odds: 1.91, oddsFormat: 'decimal', stake: 1.00, potentialReturn: 1.91, status: 'won', placedAt: '2026-04-03T14:35:00Z', resolvedAt: '2026-04-03T22:30:00Z', sportsbook: 'PrizePicks', isParlay: false },
  { id: '3', sport: 'NBA', event: 'Suns vs Heat', selection: 'Heat +4.5', odds: 1.95, oddsFormat: 'decimal', stake: 0.75, potentialReturn: 1.46, status: 'pending', placedAt: '2026-04-04T09:00:00Z', sportsbook: 'DraftKings', isParlay: false },
  { id: '4', sport: 'NBA', event: 'Nuggets vs Mavs', selection: 'Nuggets ML', odds: 1.77, oddsFormat: 'decimal', stake: 1.25, potentialReturn: 2.21, status: 'lost', placedAt: '2026-04-02T16:00:00Z', resolvedAt: '2026-04-02T22:15:00Z', sportsbook: 'DraftKings', isParlay: false },
  { id: '5', sport: 'NBA', event: 'Knicks vs 76ers', selection: 'Under 211', odds: 2.00, oddsFormat: 'decimal', stake: 1.00, potentialReturn: 2.00, status: 'won', placedAt: '2026-04-02T15:00:00Z', resolvedAt: '2026-04-02T21:45:00Z', sportsbook: 'PrizePicks', isParlay: false },
  { id: '6', sport: 'NBA', event: '3-Leg Parlay', selection: 'Lakers ML + Warriors ML + Celtics -3', odds: 6.24, oddsFormat: 'decimal', stake: 0.50, potentialReturn: 3.12, status: 'lost', placedAt: '2026-04-01T12:00:00Z', resolvedAt: '2026-04-01T23:00:00Z', sportsbook: 'DraftKings', isParlay: true, legs: [
    { event: 'Lakers vs Pelicans', selection: 'Lakers ML', odds: 1.65, status: 'won' },
    { event: 'Warriors vs Raptors', selection: 'Warriors ML', odds: 1.45, status: 'won' },
    { event: 'Celtics vs Hawks', selection: 'Celtics -3', odds: 2.60, status: 'lost' },
  ]},
];

type Filter = 'all' | BetStatus;

export default function BetHistory() {
  const { isBeginner } = useMode();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filter === 'all' ? MOCK_BETS : MOCK_BETS.filter((b) => b.status === filter);

  const stats = {
    total: MOCK_BETS.length,
    won: MOCK_BETS.filter((b) => b.status === 'won').length,
    lost: MOCK_BETS.filter((b) => b.status === 'lost').length,
    pending: MOCK_BETS.filter((b) => b.status === 'pending').length,
    totalStaked: MOCK_BETS.reduce((s, b) => s + b.stake, 0),
    totalReturns: MOCK_BETS.filter((b) => b.status === 'won').reduce((s, b) => s + b.potentialReturn, 0),
  };
  stats.totalReturns = stats.totalReturns; // net already
  const profit = stats.totalReturns - stats.totalStaked + MOCK_BETS.filter((b) => b.status === 'pending').reduce((s, b) => s + b.stake, 0);
  const winRate = stats.total > 0 ? (stats.won / (stats.won + stats.lost)) * 100 : 0;

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'pending', label: 'Pending', count: stats.pending },
    { id: 'won', label: 'Won', count: stats.won },
    { id: 'lost', label: 'Lost', count: stats.lost },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight">
          {isBeginner ? 'My Bets' : 'Bet History'}
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          {isBeginner
            ? 'See all the bets you\'ve placed and how they did.'
            : `${stats.total} bets tracked | ${winRate.toFixed(1)}% win rate`}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 text-center">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
            {isBeginner ? 'Win Rate' : 'Win %'}
          </p>
          <p className={`text-2xl font-bold stat-value ${winRate > 52 ? 'text-win' : 'text-loss'}`}>
            {winRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-text-muted mt-1">{stats.won}W - {stats.lost}L</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Staked</p>
          <p className="text-2xl font-bold stat-value text-white">${stats.totalStaked.toFixed(2)}</p>
        </div>
        <div className="glass p-4 text-center">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
            {isBeginner ? 'Money Won' : 'Returns'}
          </p>
          <p className="text-2xl font-bold stat-value text-win">${stats.totalReturns.toFixed(2)}</p>
        </div>
        <div className={`glass p-4 text-center ${profit > 0 ? 'glow-green' : 'glow-red'}`}>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
            {isBeginner ? 'Profit / Loss' : 'Net P&L'}
          </p>
          <p className={`text-2xl font-bold stat-value ${profit >= 0 ? 'text-win' : 'text-loss'}`}>
            {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
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
              ${filter === f.id
                ? 'bg-white/[0.08] text-white border border-border-glass-hover'
                : 'text-text-muted hover:text-white hover:bg-white/[0.03]'
              }`}
          >
            {f.label}
            <span className="ml-1.5 text-text-muted">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Bet List */}
      <div className="space-y-2">
        {filtered.map((bet) => (
          <GlassCard key={bet.id} padding="sm" hover>
            <div className="flex items-center gap-4">
              {/* Status */}
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  bet.status === 'won'
                    ? 'bg-win'
                    : bet.status === 'lost'
                      ? 'bg-loss'
                      : 'bg-yellow-500 animate-glow-pulse'
                }`}
              />

              {/* Event */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{bet.event}</p>
                  {bet.isParlay && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-bold">
                      Parlay
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">{bet.selection}</p>
                {bet.isParlay && bet.legs && (
                  <div className="mt-1.5 space-y-0.5">
                    {bet.legs.map((leg, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            leg.status === 'won'
                              ? 'bg-win'
                              : leg.status === 'lost'
                                ? 'bg-loss'
                                : 'bg-yellow-500'
                          }`}
                        />
                        <span className="text-text-muted">{leg.selection}</span>
                        <span className="text-text-muted font-mono">{leg.odds.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="text-right space-y-0.5">
                <p className="text-xs text-text-muted">{bet.sportsbook}</p>
                <p className="text-xs font-mono text-text-secondary">{bet.odds.toFixed(2)}</p>
              </div>

              {/* Stake & Return */}
              <div className="text-right w-24">
                <p className="text-xs text-text-muted">${bet.stake.toFixed(2)} stake</p>
                <p
                  className={`text-sm font-bold stat-value ${
                    bet.status === 'won'
                      ? 'text-win'
                      : bet.status === 'lost'
                        ? 'text-loss'
                        : 'text-yellow-500'
                  }`}
                >
                  {bet.status === 'won'
                    ? `+$${(bet.potentialReturn - bet.stake).toFixed(2)}`
                    : bet.status === 'lost'
                      ? `-$${bet.stake.toFixed(2)}`
                      : 'Pending'}
                </p>
              </div>
            </div>
          </GlassCard>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No bets match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
