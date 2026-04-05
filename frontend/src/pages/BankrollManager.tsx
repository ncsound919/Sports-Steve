import { useState } from 'react';
import { GlassCard, StatCard } from '../components/ui/GlassCard';
import ExportMenu from '../components/ui/ExportMenu';
import { useMode } from '../contexts/ModeContext';
import { useLocalSync } from '../hooks/useLocalSync';

/* ─── Kelly Criterion Calculator ─────────────────────── */

function kellyFraction(winProb: number, odds: number): number {
  // Guard: Kelly is undefined when odds <= 1 (no profit possible); return 0 (no bet).
  if (odds <= 1) return 0;
  const b = odds - 1;
  const p = winProb;
  const q = 1 - p;
  const f = (b * p - q) / b;
  return Math.max(0, f);
}

export default function BankrollManager() {
  const { isBeginner } = useMode();
  const { accounts, budgets, offline, lastSynced } = useLocalSync(60_000);

  // Bankroll state
  const [bankroll, setBankroll] = useState('100');
  const [winProb, setWinProb] = useState('55');
  const [decimalOdds, setDecimalOdds] = useState('2.00');
  const [kellyMultiplier, setKellyMultiplier] = useState('0.25');

  const bankrollNum = parseFloat(bankroll) || 0;
  const winProbNum = (parseFloat(winProb) || 0) / 100;
  // Parse odds without a fallback default — empty/invalid input produces NaN which
  // kellyFraction handles by returning 0 (odds <= 1 guard) or via isNaN checks below.
  const oddsNum = parseFloat(decimalOdds);
  const kellyMult = parseFloat(kellyMultiplier) || 0.25;

  const fullKelly = isNaN(oddsNum) ? 0 : kellyFraction(winProbNum, oddsNum);
  const adjustedKelly = fullKelly * kellyMult;
  const suggestedStake = bankrollNum * adjustedKelly;
  // Guard NaN: if inputs are invalid, ev is shown as N/A in the UI.
  const evRaw = (winProbNum * (oddsNum - 1) - (1 - winProbNum)) * suggestedStake;
  const ev = isNaN(evRaw) ? null : evRaw;

  // Map budgets from IndexedDB format
  const budgetData: Record<string, { limit: number; used: number }> = {};
  for (const b of budgets) {
    if (b.limit > 0) {
      budgetData[b.period] = { limit: b.limit, used: b.spent };
    }
  }

  // Map accounts for display
  const accountList = accounts.map((a) => {
    let status = 'healthy';
    if (a.is_limited) status = 'limited';
    else if (a.is_gubbed) status = 'gubbed';
    else if (a.balance < 10) status = 'low_balance';
    return { book: a.name, balance: a.balance, status };
  });

  // Export data for accounts
  const accountExportData = accounts.map((a) => ({
    name: a.name,
    balance: a.balance,
    total_winnings: a.total_bet_winnings,
    total_losses: a.total_bet_losses,
    net_pnl: a.net_betting_pnl,
    is_limited: a.is_limited,
    is_gubbed: a.is_gubbed,
    transactions: a.transaction_count,
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
            {isBeginner ? 'My Money' : 'Bankroll Manager'}
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            {isBeginner
              ? 'Keep track of your betting money and learn how much to bet.'
              : 'Kelly criterion sizing, budget tracking, and risk management.'}
          </p>
          {syncLabel && (
            <p className="text-[10px] text-text-muted mt-0.5">{syncLabel}</p>
          )}
        </div>
        {accounts.length > 0 && (
          <ExportMenu
            data={accountExportData}
            filename="sportsbook-accounts"
            label={isBeginner ? "Save Accounts" : "Export Accounts"}
          />
        )}
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

      {/* Offline Banner */}
      {offline && (
        <div className="px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
          Backend is offline -- showing locally saved account data.
          {accounts.length > 0 && ` ${accounts.length} accounts cached on this device.`}
        </div>
      )}

      {/* Local storage indicator */}
      {accounts.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-win/5 border border-win/10 text-[10px] text-text-muted flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-win" />
          <span>
            Account data is stored locally. Use Export to download your sportsbook balances anytime.
          </span>
        </div>
      )}

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.keys(budgetData).length > 0 ? (
          Object.entries(budgetData).map(([period, data]) => {
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
        })
        ) : (
          <GlassCard className="md:col-span-3">
            <p className="text-sm text-text-muted text-center py-4">
              {offline
                ? 'Budget data unavailable while backend is offline.'
                : 'No budget limits configured. Set them in Settings to track spending.'}
            </p>
          </GlassCard>
        )}
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
                   <p className={`text-lg font-bold ${ev === null ? 'text-text-muted' : ev >= 0 ? 'text-win' : 'text-loss'}`}>
                     {ev === null ? 'N/A' : `${ev >= 0 ? '+' : ''}$${ev.toFixed(2)}`}
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
                      {(() => {
                        // Clamp adjustedKelly to [0, 0.9999] before log to prevent -Infinity
                        // when Kelly fraction >= 1 (pathological edge case).
                        const safeKelly = Math.min(adjustedKelly, 0.9999);
                        const g =
                          winProbNum * Math.log(1 + safeKelly * (oddsNum - 1)) +
                          (1 - winProbNum) * Math.log(1 - safeKelly);
                        return isNaN(g) ? 'N/A' : (g || 0).toFixed(4);
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    {/* NOTE: Ruin probability formula below assumes even-money bets only.
                        It will overestimate ruin at higher odds — treat as a rough indicator. */}
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
      {!isBeginner && accountList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold font-display mb-4">Account Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accountList.map((acct) => (
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
