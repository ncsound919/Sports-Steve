import { useState, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useMode } from '../contexts/ModeContext';
import { convertFromDecimal, convertFromAmerican, convertFromFractional } from '../lib/betBuddy';

type OddsFormat = 'american' | 'decimal' | 'fractional';

interface ConversionResult {
  american: string;
  decimal: string;
  fractional: string;
  impliedProbability: string;
  // NOTE: potentialReturn and profit below are computed using a hardcoded $100 stake for
  // internal reference only. They are NOT rendered — the UI uses stakeNum from component
  // state to calculate potReturn/profit instead.
  potentialReturn: string;
  profit: string;
}

/* ─── Convert using betBuddy library ─── */

function convert(value: string, format: OddsFormat): ConversionResult | null {
  try {
    let odds;
    if (format === 'american') {
      const am = parseFloat(value.replace('+', ''));
      if (isNaN(am) || am === 0) return null;
      odds = convertFromAmerican(am);
    } else if (format === 'decimal') {
      const dec = parseFloat(value);
      if (isNaN(dec) || dec <= 1) return null;
      odds = convertFromDecimal(dec);
    } else {
      if (!value.includes('/')) return null;
      odds = convertFromFractional(value);
    }

    const stake = 100;
    const ret = odds.decimal * stake;

    return {
      american: odds.american > 0 ? `+${Math.round(odds.american)}` : `${Math.round(odds.american)}`,
      decimal: odds.decimal.toFixed(3),
      fractional: odds.fractional,
      impliedProbability: `${odds.impliedProbability.toFixed(1)}%`,
      potentialReturn: `$${ret.toFixed(2)}`,
      profit: `$${(ret - stake).toFixed(2)}`,
    };
  } catch {
    return null;
  }
}

export default function OddsCalculator() {
  const { isBeginner } = useMode();
  const [inputFormat, setInputFormat] = useState<OddsFormat>('american');
  const [inputValue, setInputValue] = useState('');
  const [stake, setStake] = useState('10');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const handleConvert = useCallback(() => {
    const r = convert(inputValue, inputFormat);
    setResult(r);
    if (!r && inputValue.length > 0) {
      if (inputFormat === 'decimal') {
        const dec = parseFloat(inputValue);
        setInputError(!isNaN(dec) && dec <= 1 ? 'Decimal odds must be greater than 1.00' : 'Invalid odds value');
      } else {
        setInputError('Invalid odds value');
      }
    } else {
      setInputError(null);
    }
  }, [inputValue, inputFormat]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (val.length > 0) {
      const r = convert(val, inputFormat);
      setResult(r);
      if (!r && inputFormat === 'decimal') {
        const dec = parseFloat(val);
        // Show inline error for the specific case of dec <= 1 (common user mistake)
        setInputError(!isNaN(dec) && dec <= 1 ? 'Decimal odds must be greater than 1.00' : null);
      } else {
        setInputError(null);
      }
    } else {
      setResult(null);
      setInputError(null);
    }
  };

  const stakeNum = parseFloat(stake) || 0;
  const decimalOdds = result ? parseFloat(result.decimal) : 0;
  const potReturn = decimalOdds * stakeNum;
  const profit = potReturn - stakeNum;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight">
          {isBeginner ? 'Calculate Odds' : 'Odds Calculator'}
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          {isBeginner
            ? 'Enter odds from any sportsbook and see what they mean.'
            : 'Convert between formats, calculate implied probability and returns.'}
        </p>
      </div>

      {/* Beginner Explainer */}
      {isBeginner && (
        <GlassCard className="border-win/10" glow="green">
          <h3 className="font-semibold text-win mb-2">What Are Odds?</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Odds tell you two things: <strong className="text-white">how likely</strong> something is to happen,
            and <strong className="text-white">how much you'll win</strong> if it does. There are three common formats:
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="glass-sm p-3 text-center">
              <p className="text-lg font-bold text-white">+150</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">American</p>
              <p className="text-xs text-text-secondary mt-1">Win $150 on a $100 bet</p>
            </div>
            <div className="glass-sm p-3 text-center">
              <p className="text-lg font-bold text-white">2.50</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Decimal</p>
              <p className="text-xs text-text-secondary mt-1">Get back $2.50 for every $1</p>
            </div>
            <div className="glass-sm p-3 text-center">
              <p className="text-lg font-bold text-white">3/2</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Fractional</p>
              <p className="text-xs text-text-secondary mt-1">Win $3 for every $2 bet</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Calculator */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Side */}
        <GlassCard>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-5">
            {isBeginner ? 'Enter Your Odds' : 'Input'}
          </h3>

          {/* Format Selector */}
          <div className="flex gap-2 mb-5">
            {(['american', 'decimal', 'fractional'] as OddsFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                    setInputFormat(fmt);
                    setResult(null);
                    setInputValue('');
                    setInputError(null);
                  }}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg
                  transition-all duration-200
                  ${inputFormat === fmt
                    ? 'bg-white/[0.08] text-white border border-border-glass-hover'
                    : 'text-text-muted hover:text-white hover:bg-white/[0.03]'
                  }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Odds Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">
                {isBeginner ? 'Odds (from your sportsbook)' : 'Odds Value'}
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
                placeholder={
                  inputFormat === 'american'
                    ? '+150 or -110'
                    : inputFormat === 'decimal'
                      ? '2.50'
                      : '3/2'
                }
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-border-glass
                         text-white placeholder-text-muted text-lg font-mono
                         focus:outline-none focus:border-win/40 focus:ring-1 focus:ring-win/20
                         transition-all duration-200"
              />
              {inputError && (
                <p className="mt-1.5 text-xs text-loss">{inputError}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5">
                {isBeginner ? 'How much do you want to bet?' : 'Stake ($)'}
              </label>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-border-glass
                         text-white placeholder-text-muted font-mono
                         focus:outline-none focus:border-win/40 focus:ring-1 focus:ring-win/20
                         transition-all duration-200"
              />
            </div>

            <button
              onClick={handleConvert}
              className="w-full py-3 rounded-xl bg-win/10 border border-win/30 text-win
                       font-semibold text-sm hover:bg-win/20 transition-all duration-200"
            >
              {isBeginner ? 'Show Me the Numbers' : 'Convert'}
            </button>
          </div>
        </GlassCard>

        {/* Results Side */}
        <GlassCard>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-5">
            {isBeginner ? 'What It Means' : 'Conversion Results'}
          </h3>

          {result ? (
            <div className="space-y-4">
              {/* All Formats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-sm p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">American</p>
                  <p className="text-lg font-bold font-mono text-white">{result.american}</p>
                </div>
                <div className="glass-sm p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">Decimal</p>
                  <p className="text-lg font-bold font-mono text-white">{result.decimal}</p>
                </div>
                <div className="glass-sm p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">Fractional</p>
                  <p className="text-lg font-bold font-mono text-white">{result.fractional}</p>
                </div>
              </div>

              {/* Implied Probability */}
              <div className="glass-sm p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-text-muted">
                    {isBeginner ? 'Chance of Winning (according to odds)' : 'Implied Probability'}
                  </span>
                  <span className="text-lg font-bold text-white">{result.impliedProbability}</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                   <div
                     className="h-full rounded-full bg-gradient-to-r from-win to-win-light transition-all duration-500"
                     // Clamp to max 100% — impliedProbability is a string like "52.4%"; parse
                     // it to prevent the bar from overflowing its container on extreme odds.
                     style={{ width: `${Math.min(parseFloat(result.impliedProbability) || 0, 100)}%` }}
                   />
                 </div>
                {isBeginner && (
                  <p className="text-[10px] text-text-muted mt-2">
                    The sportsbook thinks there's a {result.impliedProbability} chance this happens.
                    If you think it's higher, that could be a good bet.
                  </p>
                )}
              </div>

              {/* Returns */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-sm p-4 text-center">
                  <p className="text-xs text-text-muted mb-1">
                    {isBeginner ? 'Total You Get Back' : 'Total Return'}
                  </p>
                  <p className="text-2xl font-bold text-white stat-value">
                    ${potReturn.toFixed(2)}
                  </p>
                </div>
                <div className={`glass-sm p-4 text-center ${profit > 0 ? 'glow-green' : ''}`}>
                  <p className="text-xs text-text-muted mb-1">
                    {isBeginner ? 'Your Profit' : 'Net Profit'}
                  </p>
                  <p className={`text-2xl font-bold stat-value ${profit > 0 ? 'text-win' : 'text-loss'}`}>
                    {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                  </p>
                </div>
              </div>

              {isBeginner && (
                <p className="text-xs text-text-secondary text-center leading-relaxed">
                  If you bet <strong className="text-white">${stakeNum.toFixed(2)}</strong> and win,
                  you'll get <strong className="text-win">${potReturn.toFixed(2)}</strong> total
                  (your ${stakeNum.toFixed(2)} back + ${profit.toFixed(2)} profit).
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <span className="text-4xl mb-3">🔢</span>
              <p className="text-sm">
                {isBeginner
                  ? 'Enter odds above to see what they mean'
                  : 'Enter odds to see conversions'}
              </p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Quick Reference (Expert) */}
      {!isBeginner && (
        <GlassCard padding="sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
            Quick Reference
          </h3>
          <div className="grid grid-cols-6 gap-2 text-center">
            {[
              { am: '-200', dec: '1.50', prob: '66.7%' },
              { am: '-150', dec: '1.67', prob: '60.0%' },
              { am: '-110', dec: '1.91', prob: '52.4%' },
              { am: '+100', dec: '2.00', prob: '50.0%' },
              { am: '+150', dec: '2.50', prob: '40.0%' },
              { am: '+300', dec: '4.00', prob: '25.0%' },
            ].map((row) => (
              <div key={row.am} className="glass-sm p-2">
                <p className="text-xs font-mono font-bold text-white">{row.am}</p>
                <p className="text-[10px] text-text-muted">{row.dec} | {row.prob}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
