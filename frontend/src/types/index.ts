/* ─── Betting Types ──────────────────────────────────── */

export type OddsFormat = 'american' | 'decimal' | 'fractional';
export type BetStatus = 'pending' | 'won' | 'lost' | 'void' | 'cashout';
export type Sport = 'NBA' | 'NFL' | 'MLB' | 'NHL' | 'Soccer' | 'MMA' | 'Tennis';
export type RiskLevel = 'conservative' | 'balanced' | 'aggressive';

export interface Bet {
  id: string;
  sport: Sport;
  event: string;
  selection: string;
  odds: number;
  oddsFormat: OddsFormat;
  stake: number;
  potentialReturn: number;
  status: BetStatus;
  placedAt: string;
  resolvedAt?: string;
  sportsbook: string;
  isParlay: boolean;
  legs?: ParlayLeg[];
}

export interface ParlayLeg {
  event: string;
  selection: string;
  odds: number;
  status: BetStatus;
}

export interface BankrollState {
  totalBalance: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  winRate: number;
  totalBets: number;
  avgOdds: number;
  roi: number;
  kellyFraction: number;
  maxDailyStake: number;
  dailyStakeUsed: number;
  stopLossHit: boolean;
}

export interface AccountHealth {
  sportsbook: string;
  balance: number;
  status: 'healthy' | 'limited' | 'gubbed' | 'low_balance';
}

export interface PicksCard {
  player: string;
  stat_type: string;
  pp_line: number;
  odds: number;
  pp_projection_id: string;
  game_id: string;
  oddsapi_home: string;
  oddsapi_away: string;
  oddsapi_line: string;
  edge: number;
  sport: string;
}

export interface OddsConversion {
  american: number;
  decimal: number;
  fractional: string;
  impliedProbability: number;
}

export interface RiskAssessment {
  level: RiskLevel;
  exposure: number;
  maxExposure: number;
  utilizationPct: number;
  cooldownActive: boolean;
  dailyLossLimit: number;
  dailyLossUsed: number;
}

/* ─── API Response Types ─────────────────────────────── */

export interface SteveHealthResponse {
  status: string;
  scheduler_running: boolean;
  active_sports: string[];
}

export interface BuddyToolsResponse {
  result: number | string;
  details?: Record<string, unknown>;
}

/* ─── UI Types ───────────────────────────────────────── */

export type UserMode = 'beginner' | 'expert';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  beginnerLabel?: string;
  description?: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  example?: string;
  category: 'basics' | 'odds' | 'bet-types' | 'bankroll' | 'advanced';
}

export interface Technique {
  name: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  steps: string[];
  tips: string[];
}
