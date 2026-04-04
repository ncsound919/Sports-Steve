/**
 * Statistics Engine Tool
 * Calculates betting statistics and performance metrics
 * No external dependencies - pure TypeScript implementation
 */
export interface BetResult {
    stake: number;
    odds: number;
    won: boolean;
    date?: Date | string;
}
export interface BettingStatistics {
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
    currentStreak: {
        type: "win" | "lose" | "none";
        count: number;
    };
}
/**
 * Calculate comprehensive betting statistics
 */
export declare function calculateStatistics(bets: BetResult[]): BettingStatistics;
/**
 * Calculate statistics for a specific time period
 */
export declare function calculateStatisticsByPeriod(bets: BetResult[], startDate: Date, endDate: Date): BettingStatistics;
/**
 * Calculate Kelly Criterion for optimal bet sizing
 * Returns the fraction of bankroll to bet (0-1)
 *
 * Formula: f* = (bp - q) / b
 * Where:
 *   f* = fraction of bankroll to bet
 *   b = net odds (decimal odds - 1)
 *   p = win probability
 *   q = lose probability (1 - p)
 */
export declare function calculateKellyCriterion(winProbability: number, odds: number): number;
/**
 * Calculate expected value of a bet
 */
export declare function calculateExpectedValue(stake: number, winProbability: number, odds: number): number;
