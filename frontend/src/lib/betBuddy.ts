/**
 * Bet Buddy — Client-Side Utility Library
 *
 * All Bet Buddy functionality collapsed into the frontend.
 * Zero dependencies, pure math and formatting.
 * Replaces the separate Bet Buddy Node.js backend entirely.
 *
 * Modules:
 *   - Odds Calculator: convert between decimal/American/fractional
 *   - Statistics Engine: ROI, win rate, streaks, Kelly, EV
 *   - Bankroll Manager: stake sizing, limits, stop levels, responsible gambling
 *   - Data Exporter: CSV, JSON, TSV, HTML, Markdown export
 */

/* ═══════════════════════════════════════════════════════════
   ODDS CALCULATOR
   ═══════════════════════════════════════════════════════════ */

export interface OddsResult {
  decimal: number;
  fractional: string;
  american: number;
  impliedProbability: number;
}

function findGCD(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  if (a === 0 && b === 0) return 1; // avoid 0/0
  if (a === 0) return b;
  if (b === 0) return a;
  // Iterative to avoid stack overflow on large values
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function decimalToFractional(decimal: number): string {
  const decimalValue = decimal - 1;
  // Use /10000 precision for better fractional approximations (e.g. 1.333 → 1/3 not 33/100)
  const gcd = findGCD(Math.round(decimalValue * 10000), 10000);
  const numerator = Math.round(decimalValue * 10000) / gcd;
  const denominator = 10000 / gcd;
  return `${numerator}/${denominator}`;
}

function decimalToAmerican(decimal: number): number {
  // decimal === 1 means "no profit" — not a valid round-trippable value.
  // We return 0 here as a sentinel; callers must treat american===0 as "no-profit edge case"
  // and must NOT pass it to convertFromAmerican() (which rejects 0).
  if (decimal === 1) return 0;
  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

function americanToDecimal(american: number): number {
  if (american === 0) throw new Error('American odds cannot be 0');
  if (american > 0) {
    return american / 100 + 1;
  } else {
    return 1 - 100 / american;
  }
}

/** Convert decimal odds to all formats */
export function convertFromDecimal(decimal: number): OddsResult {
  if (decimal < 1) throw new Error('Decimal odds must be 1 or greater');
  if (decimal === 1) {
    return { decimal: 1, fractional: '0/1', american: 0, impliedProbability: 100 };
  }
  const fractional = decimalToFractional(decimal);
  const american = decimalToAmerican(decimal);
  const impliedProbability = (1 / decimal) * 100;
  return {
    decimal,
    fractional,
    american,
    impliedProbability: parseFloat(impliedProbability.toFixed(2)),
  };
}

/** Convert American odds to all formats */
export function convertFromAmerican(american: number): OddsResult {
  if (american === 0 || (american > -100 && american < 100)) {
    throw new Error('American odds must be <= -100 or >= 100');
  }
  const decimal = americanToDecimal(american);
  return convertFromDecimal(decimal);
}

/** Convert fractional odds (e.g. "5/2") to all formats */
export function convertFromFractional(fractional: string): OddsResult {
  const parts = fractional.split('/');
  if (parts.length !== 2) throw new Error('Fractional odds must be in format "numerator/denominator"');
  const numerator = parseFloat(parts[0]!);
  const denominator = parseFloat(parts[1]!);
  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
    throw new Error('Invalid fractional odds');
  }
  const decimal = numerator / denominator + 1;
  return convertFromDecimal(decimal);
}

/** Calculate potential return from stake and odds */
export function calculateReturn(
  stake: number,
  odds: number | string,
  format: 'decimal' | 'american' | 'fractional' = 'decimal',
): number {
  if (stake <= 0) throw new Error('Stake must be greater than 0');
  let decimal: number;
  if (format === 'american') {
    if (typeof odds === 'string') odds = parseFloat(odds);
    if (isNaN(odds as number) || odds === 0) throw new Error('Invalid American odds');
    decimal = americanToDecimal(odds as number);
  } else if (format === 'fractional') {
    const s = String(odds);
    const parts = s.split('/');
    if (parts.length !== 2) throw new Error('Fractional odds must be in "num/den" format');
    const num = parseFloat(parts[0]!);
    const den = parseFloat(parts[1]!);
    if (isNaN(num) || isNaN(den) || den === 0) throw new Error('Invalid fractional odds');
    decimal = num / den + 1;
  } else {
    decimal = typeof odds === 'string' ? parseFloat(odds) : odds;
    if (isNaN(decimal) || decimal < 1) throw new Error('Decimal odds must be >= 1');
  }
  return parseFloat((stake * decimal).toFixed(2));
}

/** Calculate profit from stake and odds */
export function calculateProfit(
  stake: number,
  odds: number | string,
  format: 'decimal' | 'american' | 'fractional' = 'decimal',
): number {
  const totalReturn = calculateReturn(stake, odds, format);
  return parseFloat((totalReturn - stake).toFixed(2));
}

/* ═══════════════════════════════════════════════════════════
   STATISTICS ENGINE
   ═══════════════════════════════════════════════════════════ */

export interface BetRecord {
  stake: number;
  /** Odds in decimal format. Use `oddsFormat` to document the original format. */
  odds: number;
  /** Format the odds field was originally provided in; decimal is assumed if omitted. */
  oddsFormat?: 'decimal' | 'american' | 'fractional';
  won: boolean;
  date?: string;
}

export interface BetStatistics {
  totalBets: number;
  totalStake: number;
  totalReturns: number;
  profit: number;
  roi: number;
  winRate: number;
  averageStake: number;
  averageOdds: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  currentStreak: { type: 'win' | 'lose' | 'none'; count: number };
}

function calculateStreaks(bets: BetRecord[]) {
  if (bets.length === 0) {
    return { longestWin: 0, longestLose: 0, current: { type: 'none' as const, count: 0 } };
  }
  let longestWin = 0;
  let longestLose = 0;
  let currentWinStreak = 0;
  let currentLoseStreak = 0;

  for (const bet of bets) {
    if (bet.won) {
      currentWinStreak++;
      currentLoseStreak = 0;
      longestWin = Math.max(longestWin, currentWinStreak);
    } else {
      currentLoseStreak++;
      currentWinStreak = 0;
      longestLose = Math.max(longestLose, currentLoseStreak);
    }
  }

  const current =
    currentWinStreak > 0
      ? { type: 'win' as const, count: currentWinStreak }
      : currentLoseStreak > 0
        ? { type: 'lose' as const, count: currentLoseStreak }
        : { type: 'none' as const, count: 0 };

  return { longestWin, longestLose, current };
}

/** Calculate comprehensive betting statistics */
export function calculateStatistics(bets: BetRecord[]): BetStatistics {
  if (bets.length === 0) {
    return {
      totalBets: 0, totalStake: 0, totalReturns: 0, profit: 0, roi: 0,
      winRate: 0, averageStake: 0, averageOdds: 0,
      longestWinStreak: 0, longestLoseStreak: 0,
      currentStreak: { type: 'none', count: 0 },
    };
  }

  const totalBets = bets.length;
  const totalStake = bets.reduce((s, b) => s + b.stake, 0);
  const wonBets = bets.filter((b) => b.won);
  const totalReturns = wonBets.reduce((s, b) => s + b.stake * b.odds, 0);
  const profit = totalReturns - totalStake;
  const roi = (profit / totalStake) * 100;
  const winRate = (wonBets.length / totalBets) * 100;
  const averageStake = totalStake / totalBets;
  const averageOdds = bets.reduce((s, b) => s + b.odds, 0) / totalBets;
  const streaks = calculateStreaks(bets);

  return {
    totalBets,
    totalStake: parseFloat(totalStake.toFixed(2)),
    totalReturns: parseFloat(totalReturns.toFixed(2)),
    profit: parseFloat(profit.toFixed(2)),
    roi: parseFloat(roi.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(2)),
    averageStake: parseFloat(averageStake.toFixed(2)),
    averageOdds: parseFloat(averageOdds.toFixed(2)),
    longestWinStreak: streaks.longestWin,
    longestLoseStreak: streaks.longestLose,
    currentStreak: streaks.current,
  };
}

/** Calculate statistics for a specific time period */
export function calculateStatisticsByPeriod(
  bets: BetRecord[],
  startDate: Date,
  endDate: Date,
): BetStatistics {
  const filtered = bets.filter((b) => {
    if (!b.date) return false;
    const d = new Date(b.date);
    return d >= startDate && d <= endDate;
  });
  return calculateStatistics(filtered);
}

/**
 * Kelly Criterion for optimal bet sizing.
 * f* = (bp - q) / b
 */
export function calculateKellyCriterion(winProbability: number, odds: number): number {
  if (winProbability <= 0 || winProbability >= 1) {
    throw new Error('Win probability must be between 0 and 1');
  }
  if (odds <= 1) throw new Error('Odds must be greater than 1');
  const q = 1 - winProbability;
  const b = odds - 1;
  const kelly = (b * winProbability - q) / b;
  // Clamp to [0, 0.5] — Kelly > 0.5 means "bet more than half your bankroll" which is
  // never practical and exposes the bettor to catastrophic ruin. Full Kelly (1.0) is
  // theoretical; in practice 0.5 is already considered very aggressive.
  return Math.max(0, Math.min(0.5, parseFloat(kelly.toFixed(4))));
}

/** Calculate expected value of a bet */
export function calculateExpectedValue(
  stake: number,
  winProbability: number,
  odds: number,
): number {
  // Consistent with calculateKellyCriterion: reject 0 and 1 (degenerate outcomes)
  if (winProbability <= 0 || winProbability >= 1) {
    throw new Error('Win probability must be strictly between 0 and 1');
  }
  const winAmount = stake * odds - stake;
  const loseAmount = -stake;
  const ev = winProbability * winAmount + (1 - winProbability) * loseAmount;
  return parseFloat(ev.toFixed(2));
}

/* ═══════════════════════════════════════════════════════════
   BANKROLL MANAGER
   ═══════════════════════════════════════════════════════════ */

/**
 * Risk tolerance levels.
 * 'balanced' is an alias for 'moderate' — both map to the same behaviour.
 * The UI uses 'balanced' as a friendlier label; the core math uses 'moderate'.
 */
export type RiskTolerance = 'conservative' | 'moderate' | 'balanced' | 'aggressive';

const RISK_MULTIPLIERS: Record<RiskTolerance, number> = {
  conservative: 0.01,
  moderate: 0.02,
  balanced: 0.02, // alias for moderate
  aggressive: 0.05,
};

const MAX_STAKE_MULTIPLIER = 2;

export interface SuggestedStakeResult {
  suggestedStake: number;
  maxStake: number;
  minStake: number;
  riskLevel: RiskTolerance;
  reasoning: string;
  /** False when there is no positive edge. When false, suggestedStake equals minStake
   *  as a floor — callers should treat this as a "skip this bet" signal. */
  hasEdge: boolean;
}

/** Suggested stake via fractional Kelly + risk tolerance */
export function calculateSuggestedStake(
  bankroll: number,
  odds: number,
  estimatedWinProbability: number,
  riskTolerance: RiskTolerance = 'moderate',
): SuggestedStakeResult {
  if (bankroll <= 0) throw new Error('Bankroll must be greater than 0');
  if (odds <= 1) throw new Error('Odds must be greater than 1');
  if (estimatedWinProbability <= 0 || estimatedWinProbability >= 1) {
    throw new Error('Estimated win probability must be between 0 and 1 (exclusive)');
  }

  const b = odds - 1;
  const p = estimatedWinProbability;
  const q = 1 - p;
  const fullKelly = (b * p - q) / b;

  const fractionMap: Record<RiskTolerance, number> = {
    conservative: 0.25,
    moderate: 0.5,
    balanced: 0.5, // alias for moderate
    aggressive: 0.75,
  };
  const kellyFraction = fractionMap[riskTolerance] || 0.5;

  let suggestedStake = fullKelly > 0 ? bankroll * fullKelly * kellyFraction : 0;

  const maxMultiplier = RISK_MULTIPLIERS[riskTolerance] || 0.02;
  const maxStake = bankroll * maxMultiplier * MAX_STAKE_MULTIPLIER;
  const minStake = Math.max(1, bankroll * 0.001);

  suggestedStake = Math.max(minStake, Math.min(maxStake, suggestedStake));
  suggestedStake = parseFloat(suggestedStake.toFixed(2));

  let reasoning: string;
  if (fullKelly <= 0) {
    reasoning = 'No positive edge detected. Consider skipping this bet or reducing stake.';
    suggestedStake = minStake;
  } else if (fullKelly > maxMultiplier * MAX_STAKE_MULTIPLIER) {
    reasoning = `High edge detected, but stake capped at ${(maxMultiplier * MAX_STAKE_MULTIPLIER * 100).toFixed(0)}% of bankroll for safety.`;
  } else {
    reasoning = `Based on ${(kellyFraction * 100).toFixed(0)}% Kelly Criterion with ${riskTolerance} risk profile.`;
  }

  return {
    suggestedStake,
    maxStake: parseFloat(maxStake.toFixed(2)),
    minStake: parseFloat(minStake.toFixed(2)),
    riskLevel: riskTolerance,
    reasoning,
    hasEdge: fullKelly > 0,
  };
}

/** Flat stake based on bankroll and risk tolerance */
export function calculateFlatStake(
  bankroll: number,
  riskTolerance: RiskTolerance = 'moderate',
): number {
  if (bankroll <= 0) throw new Error('Bankroll must be greater than 0');
  const multiplier = RISK_MULTIPLIERS[riskTolerance] || 0.02;
  return parseFloat(Math.max(1, bankroll * multiplier).toFixed(2));
}

/** Unit size for bankroll tracking */
export function calculateUnitSize(bankroll: number, unitsInBankroll = 100): number {
  if (bankroll <= 0) throw new Error('Bankroll must be greater than 0');
  if (unitsInBankroll <= 0) throw new Error('Units in bankroll must be greater than 0');
  return parseFloat((bankroll / unitsInBankroll).toFixed(2));
}

export interface LimitCheckResult {
  allowed: boolean;
  warnings: string[];
  violations: string[];
}

/** Check if a bet exceeds responsible gambling limits */
export function checkBettingLimits(
  stake: number,
  config: {
    totalBankroll: number;
    maxStakePercentage?: number;
    dailyLimit?: number;
    weeklyLimit?: number;
    monthlyLimit?: number;
  },
  currentDailyWagered = 0,
  currentWeeklyWagered = 0,
  currentMonthlyWagered = 0,
): LimitCheckResult {
  const warnings: string[] = [];
  const violations: string[] = [];

  const maxStakePercent = config.maxStakePercentage || 10;
  const maxStake = config.totalBankroll * (maxStakePercent / 100);
  if (stake > maxStake) {
    violations.push(`Stake exceeds ${maxStakePercent}% of bankroll ($${maxStake.toFixed(2)} max)`);
  }

  if (config.dailyLimit !== undefined) {
    if (currentDailyWagered + stake > config.dailyLimit) {
      violations.push(`Bet would exceed daily limit of $${config.dailyLimit.toFixed(2)}`);
    } else if (currentDailyWagered + stake > config.dailyLimit * 0.8) {
      warnings.push('Approaching daily betting limit (>80%)');
    }
  }

  if (config.weeklyLimit !== undefined) {
    if (currentWeeklyWagered + stake > config.weeklyLimit) {
      violations.push(`Bet would exceed weekly limit of $${config.weeklyLimit.toFixed(2)}`);
    } else if (currentWeeklyWagered + stake > config.weeklyLimit * 0.8) {
      warnings.push('Approaching weekly betting limit (>80%)');
    }
  }

  if (config.monthlyLimit !== undefined) {
    if (currentMonthlyWagered + stake > config.monthlyLimit) {
      violations.push(`Bet would exceed monthly limit of $${config.monthlyLimit.toFixed(2)}`);
    } else if (currentMonthlyWagered + stake > config.monthlyLimit * 0.8) {
      warnings.push('Approaching monthly betting limit (>80%)');
    }
  }

  if (stake > config.totalBankroll * 0.25) {
    warnings.push('Stake is more than 25% of total bankroll - high risk!');
  }

  return { allowed: violations.length === 0, warnings, violations };
}

export interface StopLevels {
  stopLoss: number;
  stopLossPercentage: number;
  takeProfit: number;
  takeProfitPercentage: number;
  recommendations: string[];
}

/** Calculate stop-loss and take-profit levels */
export function calculateStopLevels(
  bankroll: number,
  riskTolerance: RiskTolerance = 'moderate',
): StopLevels {
  const stopLossMap: Record<RiskTolerance, number> = { conservative: 0.1, moderate: 0.2, balanced: 0.2, aggressive: 0.3 };
  const takeProfitMap: Record<RiskTolerance, number> = { conservative: 0.15, moderate: 0.3, balanced: 0.3, aggressive: 0.5 };

  const slPct = stopLossMap[riskTolerance] || 0.2;
  const tpPct = takeProfitMap[riskTolerance] || 0.3;
  const stopLoss = bankroll * (1 - slPct);
  const takeProfit = bankroll * (1 + tpPct);

  return {
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    stopLossPercentage: slPct * 100,
    takeProfit: parseFloat(takeProfit.toFixed(2)),
    takeProfitPercentage: tpPct * 100,
    recommendations: [
      `Stop betting for the day if bankroll drops to $${stopLoss.toFixed(2)}`,
      `Consider taking profits when bankroll reaches $${takeProfit.toFixed(2)}`,
      'Take regular breaks to maintain clear decision-making',
      'Never chase losses - stick to your staking plan',
    ],
  };
}

/** Responsible gambling tips and resources */
export function getResponsibleGamblingTips() {
  return {
    tips: [
      'Set a budget before you start and stick to it',
      'Never bet more than you can afford to lose',
      'Take regular breaks from betting',
      'Do not chase your losses',
      'Balance betting with other activities',
      'Do not bet when under the influence of alcohol or drugs',
      'If gambling stops being fun, stop gambling',
      'Keep track of time and money spent betting',
      'Treat betting as entertainment, not as income',
      'Seek help if you feel gambling is becoming a problem',
    ],
    resources: [
      { name: 'National Council on Problem Gambling', url: 'https://www.ncpgambling.org/' },
      { name: 'Gamblers Anonymous', url: 'https://www.gamblersanonymous.org/' },
      { name: 'GamCare', url: 'https://www.gamcare.org.uk/' },
      { name: 'BeGambleAware', url: 'https://www.begambleaware.org/' },
    ],
  };
}

export interface SessionEvaluation {
  shouldPause: boolean;
  reason: string | null;
  recommendation: string;
}

/** Evaluate if betting should be paused based on recent results */
export function evaluateBettingSession(
  recentResults: Array<{ won: boolean }>,
  bankroll: number,
  originalBankroll: number,
): SessionEvaluation {
  if (recentResults.length === 0) {
    return { shouldPause: false, reason: null, recommendation: 'Good luck! Remember to bet responsibly.' };
  }

  if (originalBankroll <= 0) {
    return { shouldPause: true, reason: 'Original bankroll is zero or negative', recommendation: 'Set a valid starting bankroll before continuing.' };
  }

  const lastFive = recentResults.slice(-5);
  const losesInLastFive = lastFive.filter((r) => !r.won).length;
  const bankrollChange = ((bankroll - originalBankroll) / originalBankroll) * 100;

  if (losesInLastFive >= 4) {
    return { shouldPause: true, reason: 'Lost 4 or more of last 5 bets', recommendation: 'Consider taking a break. Chasing losses often leads to more losses.' };
  }
  if (bankrollChange <= -20) {
    return { shouldPause: true, reason: 'Bankroll down 20% or more', recommendation: 'Stop-loss threshold reached. Take a break and reassess your strategy.' };
  }
  if (bankrollChange >= 30) {
    return { shouldPause: false, reason: null, recommendation: 'Great session! Consider locking in some profits by reducing stake or withdrawing.' };
  }
  if (losesInLastFive >= 3) {
    return { shouldPause: false, reason: null, recommendation: 'Lost 3 of last 5 bets. Consider reducing stake or taking a short break.' };
  }

  return { shouldPause: false, reason: null, recommendation: 'Session going well. Continue following your staking plan.' };
}

/* ═══════════════════════════════════════════════════════════
   DATA EXPORTER
   ═══════════════════════════════════════════════════════════ */

type ExportFormat = 'csv' | 'json' | 'jsonlines' | 'tsv' | 'html' | 'markdown';

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/** Sanitize a cell value to prevent CSV formula injection (=, +, -, @, tab, CR) */
function sanitizeCsvCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** Export records to CSV */
export function exportToCSV(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '';
  const keys = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  const header = keys.join(',');
  const rows = records.map((r) =>
    keys.map((k) => {
      const v = r[k];
      if (v === null || v === undefined) return '';
      let s = String(v);
      // Step 1: prefix dangerous leading chars to prevent formula injection.
      // This may introduce a leading single-quote into `s`.
      s = sanitizeCsvCell(s);
      // Step 2: quote the (possibly now-prefixed) value if it contains delimiters.
      // This correctly handles the case where the prefix itself added characters.
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(','),
  );
  // Add UTF-8 BOM so Excel on Windows correctly opens non-ASCII characters
  return '\uFEFF' + [header, ...rows].join('\n');
}

/** Export records to pretty JSON */
export function exportToJSON(records: unknown[]): string {
  return JSON.stringify(records, null, 2);
}

/** Export records to JSON Lines (one object per line) */
export function exportToJSONLines(records: unknown[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n');
}

/** Export records to TSV */
export function exportToTSV(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '';
  const keys = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  const header = keys.join('\t');
  const rows = records.map((r) =>
    keys.map((k) => {
      const v = r[k];
      if (v === null || v === undefined) return '';
      return String(v).replace(/[\t\r\n]/g, ' ');
    }).join('\t'),
  );
  return [header, ...rows].join('\n');
}

/** Export records to HTML table */
export function exportToHTML(records: Record<string, unknown>[]): string {
  if (records.length === 0) return '<table><tr><td>No data</td></tr></table>';
  const keys = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  const header = `<thead><tr>${keys.map((k) => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead>`;
  const rows = records.map((r) => {
    const cells = keys.map((k) => `<td>${escapeHtml(String(r[k] ?? ''))}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table>${header}<tbody>${rows}</tbody></table>`;
}

/** Export records to Markdown table */
export function exportToMarkdown(records: Record<string, unknown>[]): string {
  if (records.length === 0) return 'No data available';
  const keys = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  const header = `| ${keys.join(' | ')} |`;
  const separator = `| ${keys.map(() => '---').join(' | ')} |`;
  const rows = records.map((r) => {
    const values = keys.map((k) => String(r[k] ?? '').replace(/[\r\n]/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|'));
    return `| ${values.join(' | ')} |`;
  }).join('\n');
  return `${header}\n${separator}\n${rows}`;
}

/** Export with format selection */
export function exportData(records: Record<string, unknown>[], format: ExportFormat = 'json'): string {
  switch (format) {
    case 'csv': return exportToCSV(records);
    case 'json': return exportToJSON(records);
    case 'jsonlines': return exportToJSONLines(records);
    case 'tsv': return exportToTSV(records);
    case 'html': return exportToHTML(records);
    case 'markdown': return exportToMarkdown(records);
    default: return exportToJSON(records);
  }
}

/** Trigger a file download in the browser */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke to give browsers time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
