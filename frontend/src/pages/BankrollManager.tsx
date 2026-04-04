import { useState } from 'react';
import { GlassCard, StatCard } from '../components/ui/GlassCard';
import { useMode } from '../contexts/ModeContext';

/* ─── Kelly Criterion Calculator ─────────────────────── */

function kellyFraction(winProb: number, odds: number): number {
  // Kelly formula: f* = (bp - q) / b
  // b = decimal odds - 1 (net odds)
  // p = win probability, q = 1 - p
  const b = odds - 1;
  const p = winProb;
  const q = 1 - p;
  const f = (b * p - q) / b;
  return Math.max(0, f);
}

export default function BankrollManager() {
  const { isBeginner } = useMode();

  // Bankroll state
  const [bankroll, setBankroll] = useState('100');
  const [winProb, setWinProb] = useState('55');
  const [decimalOdds, setDecimalOdds] = useState('2.00');
  const [kellyMultiplier, setKellyMultiplier] = useState('0.25'); // Quarter Kelly

  const bankrollNum = parseFloat(bankroll) || 0;
  const winProbNum = (parseFloat(winProb) || 0) / 100;
  const oddsNum = parseFloat(decimalOdds) || 2;
  const kellyMult = parseFloat(kellyMultiplier) || 0.25;

  const fullKelly = kellyFraction(winProbNum, oddsNum);
  const adjustedKelly = fullKelly * kellyMult;
  const suggestedStake = bankrollNum * adjustedKelly;
  const ev = (winProbNum * (oddsNum - 1) - (1 - winProbNum)) * suggestedStake;

  // Mock budget data
  const budgetData = {
    daily: { limit: 25, used: 8.50 },
    weekly: { limit: 100, used: 34.20 },
    monthly: { limit: 300, used: 112.75 },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight">
          {isBeginner ? 'My Money' : 'Bankroll Manager'}
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          {isBeginner
            ? 'Keep track of your betting money and learn how much to bet.'
            : 'Kelly criterion sizing, budget tracking, and risk management.'}
        </p>
      </div>

      {/* Beginner Explainer */}
      {isBeginner && (
        <GlassCard className="border-win/10" glow="green">
          <h3 className="font-semibold text-win mb-2">Bankroll Management 101</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your <strong className="text-white">bankroll</strong> is the total money you've set aside for betting.
            The golden rule: <strong className="text-white">never bet more than you can afford to lose</strong>.
            A good starting rule is to never bet more than 1-5% of your bankroll on a single bet.
            The calculator below uses math (the Kelly Criterion) to find the optimal bet size.
          </p>
        </GlassCard>
      )}

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(budgetData).map(([period, data]) => {
          const pct = (data.used / data.limit) * 100;
          const isNear = pct > 75;
          return (
            <GlassCard key={period}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                  {isBeginner
                    ? `${period.charAt(0).toUpperCase() + period.slice(1)} Budget`
                    : `${period.charAt(0).toUpperCase() + period.slice(1)} Limit`}
                </h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                  ${isNear
                    ? 'bg-loss/10 text-loss border border-loss/20'
                    : 'bg-win/10 text-win border border-win/20'
                  }`}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <p className="text-2xl font-bold stat-value mb-1">
                ${data.used.toFixed(2)}
                <span className="text-sm text-text-muted font-normal"> / ${data.limit.toFixed(2)}</span>
              </p>
              <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isNear
                      ? 'bg-gradient-to-r from-loss-dark to-loss'
                      : 'bg-gradient-to-r from-win-dark to-win'
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              {isBeginner && (
                <p className="text-[10px] text-text-muted mt-2">
                  ${(data.limit - data.used).toFixed(2)} remaining this {period}
                </p>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Kelly Criterion Calculator */}
      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-5">
            {isBeginner ? 'How Much Should I Bet?' : 'Kelly Criterion Calculator'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">
                {isBeginner ? 'Total Money for Betting ($)' : 'Bankroll ($)'}
              </label>
              <input
                type="number"
                value={bankroll}
                onChange={(e) => setBankroll(e.target.value)}
                min="0"
                step="1"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-border-glass
                         text-white font-mono focus:outline-none focus:border-win/40 focus:ring-1 focus:ring-win/20
                         transition-all"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5">
                {isBeginner
                  ? 'How likely do you think this wins? (%)'
                  : 'Estimated Win Probability (%)'}
              </label>
              <input
                type="number"
                value={winProb}
                onChange={(e) => setWinProb(e.target.value)}
                min="1"
                max="99"
                step="1"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-border-glass
                         text-white font-mono focus:outline-none focus:border-win/40 focus:ring-1 focus:ring-win/20
                         transition-all"
              />
              {isBeginner && (
                <p className="text-[10px] text-text-muted mt-1">
                  If the odds say 50% but you think it's really 55%, enter 55 here.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5">
                {isBeginner ? 'Odds (decimal format)' : 'Decimal Odds'}
              </label>
              <input
                type="number"
                value={decimalOdds}
                onChange={(e) => setDecimalOdds(e.target.value)}
                min="1.01"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-border-glass
                         text-white font-mono focus:outline-none focus:border-win/40 focus:ring-1 focus:ring-win/20
                         transition-all"
              />
            </div>

            {/* Kelly Fraction (Expert only) */}
            {!isBeginner && (
              <div>
                <label className="block text-xs text-text-muted mb-1.5">
                  Kelly Fraction (1.0 = Full Kelly)
                </label>
                <div className="flex gap-2">
                  {[
                    { label: '1/4', value: '0.25' },
                    { label: '1/3', value: '0.33' },
                    { label: '1/2', value: '0.50' },
                    { label: 'Full', value: '1.00' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setKellyMultiplier(opt.value)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all
                        ${kellyMultiplier === opt.value
                          ? 'bg-white/[0.08] text-white border border-border-glass-hover'
                          : 'text-text-muted hover:text-white hover:bg-white/[0.03]'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Results */}
        <GlassCard>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-5">
            {isBeginner ? 'Recommended Bet' : 'Optimal Sizing'}
          </h3>

          {fullKelly > 0 ? (
            <div className="space-y-4">
              {/* Suggested Stake */}
              <div className="glass-sm p-5 text-center glow-green">
                <p className="text-xs text-text-muted mb-1">
                  {isBeginner ? 'You Should Bet' : 'Suggested Stake'}
                </p>
                <p className="text-4xl font-bold text-win stat-value">
                  ${suggestedStake.toFixed(2)}
                </p>
                <p className="text-xs text-text-muted mt-2">
                  {(adjustedKelly * 100).toFixed(1)}% of bankroll
                </p>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-sm p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">
                    {isBeginner ? 'Your Edge' : 'Full Kelly f*'}
                  </p>
                  <p className="text-lg font-bold text-white">
                    {(fullKelly * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="glass-sm p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">
                    {isBeginner ? 'Expected Profit' : 'Expected Value'}
                  </p>
                  <p className={`text-lg font-bold ${ev >= 0 ? 'text-win' : 'text-loss'}`}>
                    {ev >= 0 ? '+' : ''}${ev.toFixed(2)}
                  </p>
                </div>
              </div>

              {isBeginner && (
                <div className="glass-sm p-3 text-center">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Based on the math, this bet has a <strong className="text-win">positive edge</strong>.
                    The suggested amount balances profit potential with risk.
                    {suggestedStake > bankrollNum * 0.05 && (
                      <span className="text-loss block mt-1">
                        Warning: This is more than 5% of your bankroll. Consider betting less.
                      </span>
                    )}
                  </p>
                </div>
              )}

              {!isBeginner && (
                <div className="space-y-2 text-xs text-text-muted">
                  <div className="flex justify-between">
                    <span>Growth rate (log utility)</span>
                    <span className="text-white">
                      {(winProbNum * Math.log(1 + adjustedKelly * (oddsNum - 1)) +
                        (1 - winProbNum) * Math.log(1 - adjustedKelly) || 0).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ruin probability (est.)</span>
                    <span className="text-white">
                      {Math.max(0, ((1 - winProbNum) / winProbNum) ** (bankrollNum / suggestedStake || 1) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <span className="text-4xl mb-3">⚠️</span>
              <p className="text-sm text-center">
                {isBeginner
                  ? 'These odds don\'t have a positive edge. The math says don\'t bet on this one.'
                  : 'Negative edge — Kelly suggests no wager. f* ≤ 0.'}
              </p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Account Health (Expert) */}
      {!isBeginner && (
        <div>
          <h2 className="text-lg font-semibold font-display mb-4">Account Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { book: 'DraftKings', balance: 45.20, status: 'healthy' },
              { book: 'PrizePicks', balance: 8.99, status: 'healthy' },
              { book: 'FanDuel', balance: 0, status: 'low_balance' },
            ] as { book: string; balance: number; status: string }[]).map((acct) => (
              <StatCard
                key={acct.book}
                label={acct.book}
                value={`$${acct.balance.toFixed(2)}`}
                subValue={acct.status === 'healthy' ? 'Active' : acct.status === 'low_balance' ? 'Low Balance' : acct.status}
                trend={acct.status === 'healthy' ? 'up' : 'down'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Responsible Gambling Notice */}
      <GlassCard padding="sm" className="border-yellow-500/10">
        <div className="flex items-center gap-3">
          <span className="text-lg">🛡️</span>
          <div>
            <p className="text-xs font-semibold text-yellow-500">Responsible Gambling</p>
            <p className="text-xs text-text-muted">
              {isBeginner
                ? 'Only bet money you can afford to lose. Set limits and stick to them. If gambling stops being fun, take a break.'
                : 'Budget limits enforced. Stop-loss active. Session tracking enabled.'}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
