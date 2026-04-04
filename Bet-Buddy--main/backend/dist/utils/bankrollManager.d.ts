/**
 * Bankroll Management Tool
 * Calculate stake sizes based on bankroll and risk tolerance
 * Promote responsible gambling with betting limits
 * No external dependencies - pure TypeScript implementation
 */
export interface BankrollConfig {
    totalBankroll: number;
    riskTolerance: "conservative" | "moderate" | "aggressive";
    dailyLimit?: number;
    weeklyLimit?: number;
    monthlyLimit?: number;
    maxStakePercentage?: number;
}
export interface StakeSuggestion {
    suggestedStake: number;
    maxStake: number;
    minStake: number;
    riskLevel: string;
    reasoning: string;
}
export interface BankrollStatus {
    currentBankroll: number;
    totalDeposited: number;
    totalWithdrawn: number;
    profitLoss: number;
    profitLossPercentage: number;
    betsToday: number;
    betsThisWeek: number;
    betsThisMonth: number;
    amountWageredToday: number;
    amountWageredThisWeek: number;
    amountWageredThisMonth: number;
    remainingDailyLimit: number | null;
    remainingWeeklyLimit: number | null;
    remainingMonthlyLimit: number | null;
}
/**
 * Calculate suggested stake based on Kelly Criterion and risk tolerance
 * Uses a fractional Kelly approach for safety
 */
export declare function calculateSuggestedStake(bankroll: number, odds: number, estimatedWinProbability: number, riskTolerance?: "conservative" | "moderate" | "aggressive"): StakeSuggestion;
/**
 * Calculate flat stake based on bankroll and risk tolerance
 * Simple percentage-based staking without Kelly
 */
export declare function calculateFlatStake(bankroll: number, riskTolerance?: "conservative" | "moderate" | "aggressive"): number;
/**
 * Calculate unit size for bankroll management
 * Commonly used for tracking bets in "units"
 */
export declare function calculateUnitSize(bankroll: number, unitsInBankroll?: number): number;
/**
 * Check if a bet exceeds responsible gambling limits
 */
export declare function checkBettingLimits(stake: number, config: BankrollConfig, currentDailyWagered?: number, currentWeeklyWagered?: number, currentMonthlyWagered?: number): {
    allowed: boolean;
    warnings: string[];
    violations: string[];
};
/**
 * Calculate stop-loss and take-profit levels
 */
export declare function calculateStopLevels(bankroll: number, riskTolerance?: "conservative" | "moderate" | "aggressive"): {
    stopLoss: number;
    stopLossPercentage: number;
    takeProfit: number;
    takeProfitPercentage: number;
    recommendations: string[];
};
/**
 * Get responsible gambling tips and resources
 */
export declare function getResponsibleGamblingTips(): {
    tips: string[];
    resources: {
        name: string;
        description: string;
        url: string;
    }[];
};
/**
 * Evaluate if betting should be paused based on recent results
 */
export declare function evaluateBettingSession(recentResults: {
    won: boolean;
    stake: number;
}[], bankroll: number, originalBankroll: number): {
    shouldPause: boolean;
    reason: string | null;
    recommendation: string;
};
