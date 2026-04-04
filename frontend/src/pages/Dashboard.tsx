import { useState } from 'react';
import { GlassCard, StatCard } from '../components/ui/GlassCard';
import { useMode } from '../contexts/ModeContext';
import { steve } from '../api/client';

/* ─── Mock data (replace with live API calls) ────────── */

const MOCK_STATS = {
  dailyPnL: 12.45,
  weeklyPnL: 34.20,
  monthlyPnL: -8.15,
  winRate: 0.584,
  totalBets: 47,
  activeBets: 3,
  avgOdds: 1.95,
  roi: 0.067,
  bankroll: 8.99,
  kellyFraction: 0.12,
  streak: 4,
  streakType: 'W' as const,
};

const MOCK_RECENT_BETS = [
  { id: '1', event: 'Lakers vs Celtics', selection: 'Lakers ML', odds: '+145', stake: 1.50, status: 'won' as const, pnl: 2.18 },
  { id: '2', event: 'Warriors vs Bucks', selection: 'Over 224.5', odds: '-110', stake: 1.00, status: 'won' as const, pnl: 0.91 },
  { id: '3', event: 'Suns vs Heat', selection: 'Heat +4.5', odds: '-105', stake: 0.75, status: 'pending' as const, pnl: 0 },
  { id: '4', event: 'Nuggets vs Mavs', selection: 'Nuggets ML', odds: '-130', stake: 1.25, status: 'lost' as const, pnl: -1.25 },
  { id: '5', event: 'Knicks vs 76ers', selection: 'Under 211', odds: '+100', stake: 1.00, status: 'won' as const, pnl: 1.00 },
];

export default function Dashboard() {
  const { isBeginner } = useMode();
  const [isRunning, setIsRunning] = useState(false);
  const stats = MOCK_STATS;

  const handleDailyRun = async () => {
    setIsRunning(true);
    try {
      await steve.triggerDailyRun();
    } catch {
      // Backend not running — expected in standalone mode
    } finally {
      setTimeout(() => setIsRunning(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">
            {isBeginner ? 'Welcome Back' : 'Dashboard'}
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            {isBeginner
              ? 'Here\'s how your bets are doing today.'
              : `${stats.activeBets} active bets | Kelly f* ${(stats.kellyFraction * 100).toFixed(1)}%`}
          </p>
        </div>
        <button
          onClick={handleDailyRun}
          disabled={isRunning}
          className="glass-sm px-5 py-2.5 text-sm font-medium text-win border border-win/20
                     hover:bg-win/10 hover:border-win/30 transition-all duration-200
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? 'Analyzing...' : isBeginner ? 'Find Bets' : 'Run Daily Assessment'}
        </button>
      </div>

      {/* Beginner Welcome Card */}
      {isBeginner && (
        <GlassCard className="border-win/10" glow="green">
          <div className="flex items-start gap-4">
            <div className="text-3xl">💡</div>
            <div>
              <h3 className="font-semibold text-win mb-1">New to Betting?</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Sports Steve is an AI that finds the best bets for you using math and statistics.
                It only bets when it finds a genuine <strong className="text-white">edge</strong> — meaning the
                real probability of winning is higher than what the odds suggest. Check out the{' '}
                <a href="/help" className="text-win underline underline-offset-2">Help Center</a>{' '}
                to learn the basics.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={isBeginner ? "Today's Profit" : 'Daily P&L'}
          value={`$${stats.dailyPnL.toFixed(2)}`}
          trend={stats.dailyPnL >= 0 ? 'up' : 'down'}
          tip="How much you've won or lost today"
          showTip={isBeginner}
        />
        <StatCard
          label={isBeginner ? 'How Often You Win' : 'Win Rate'}
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          subValue={`${stats.totalBets} total bets`}
          trend={stats.winRate > 0.52 ? 'up' : 'down'}
          tip="Percentage of bets that won"
          showTip={isBeginner}
        />
        <StatCard
          label={isBeginner ? 'Money Available' : 'Bankroll'}
          value={`$${stats.bankroll.toFixed(2)}`}
          trend="neutral"
          tip="Total money available for betting"
          showTip={isBeginner}
        />
        <StatCard
          label={isBeginner ? 'Current Streak' : 'Streak'}
          value={`${stats.streak}${stats.streakType}`}
          trend={stats.streakType === 'W' ? 'up' : 'down'}
          tip={`You've ${stats.streakType === 'W' ? 'won' : 'lost'} ${stats.streak} bets in a row`}
          showTip={isBeginner}
        />
      </div>

      {/* Expert-only: Extended Stats */}
      {!isBeginner && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Weekly P&L" value={`$${stats.weeklyPnL.toFixed(2)}`} trend={stats.weeklyPnL >= 0 ? 'up' : 'down'} />
          <StatCard label="Monthly P&L" value={`$${stats.monthlyPnL.toFixed(2)}`} trend={stats.monthlyPnL >= 0 ? 'up' : 'down'} />
          <StatCard label="Avg Odds" value={stats.avgOdds.toFixed(2)} trend="neutral" />
          <StatCard label="ROI" value={`${(stats.roi * 100).toFixed(1)}%`} trend={stats.roi >= 0 ? 'up' : 'down'} />
        </div>
      )}

      {/* Risk Meter */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            {isBeginner ? 'Safety Meter' : 'Risk Exposure'}
          </h3>
          <span className="text-xs text-win font-medium px-2 py-0.5 rounded-full bg-win/10 border border-win/20">
            LOW RISK
          </span>
        </div>
        {isBeginner && (
          <p className="text-xs text-text-muted mb-3">
            This shows how much of your money is currently at risk. Green = safe, Red = be careful.
          </p>
        )}
        <div className="h-3 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-win to-win-light transition-all duration-700"
            style={{ width: '28%' }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-text-muted uppercase tracking-wider">
          <span>0%</span>
          <span>28% used</span>
          <span>100%</span>
        </div>
      </GlassCard>

      {/* Recent Bets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-display">
            {isBeginner ? 'Your Recent Bets' : 'Recent Activity'}
          </h2>
          <a
            href="/bets"
            className="text-xs text-text-muted hover:text-white transition-colors"
          >
            View all →
          </a>
        </div>

        <div className="space-y-2">
          {MOCK_RECENT_BETS.map((bet) => (
            <GlassCard key={bet.id} padding="sm" hover className="flex items-center gap-4">
              {/* Status Indicator */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  bet.status === 'won'
                    ? 'bg-win'
                    : bet.status === 'lost'
                      ? 'bg-loss'
                      : 'bg-yellow-500 animate-glow-pulse'
                }`}
              />

              {/* Event Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{bet.event}</p>
                <p className="text-xs text-text-muted">{bet.selection}</p>
              </div>

              {/* Odds */}
              <div className="text-right">
                <p className="text-sm font-mono text-text-secondary">{bet.odds}</p>
                <p className="text-[10px] text-text-muted">${bet.stake.toFixed(2)} stake</p>
              </div>

              {/* P&L */}
              <div className="text-right w-20">
                <p
                  className={`text-sm font-bold stat-value ${
                    bet.status === 'won'
                      ? 'text-win'
                      : bet.status === 'lost'
                        ? 'text-loss'
                        : 'text-yellow-500'
                  }`}
                >
                  {bet.status === 'pending'
                    ? 'Pending'
                    : `${bet.pnl >= 0 ? '+' : ''}$${bet.pnl.toFixed(2)}`}
                </p>
                <p className="text-[10px] text-text-muted uppercase">
                  {bet.status}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Scheduler Status (Expert only) */}
      {!isBeginner && (
        <GlassCard padding="sm">
          <div className="flex items-center gap-6 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-win" />
              <span>Scheduler active</span>
            </div>
            <span>Next assessment: 09:00 AM</span>
            <span>Next resolution: :05 hourly</span>
            <span>Active sports: NBA</span>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
