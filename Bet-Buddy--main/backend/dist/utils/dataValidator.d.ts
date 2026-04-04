/**
 * Data Validator Tool
 * Validates betting data inputs
 * No external dependencies - pure TypeScript implementation
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}
/**
 * Validate bet stake amount
 */
export declare function validateStake(stake: number, minStake?: number, maxStake?: number): ValidationResult;
/**
 * Validate odds value
 */
export declare function validateOdds(odds: number | string, format?: "decimal" | "american" | "fractional"): ValidationResult;
/**
 * Validate date string or Date object
 */
export declare function validateDate(date: string | Date): ValidationResult;
/**
 * Validate bet result (won/lost)
 */
export declare function validateBetResult(result: boolean | string): ValidationResult;
/**
 * Validate complete bet data
 */
export interface BetData {
    stake: number;
    odds: number | string;
    oddsFormat?: "decimal" | "american" | "fractional";
    result: boolean | string;
    date?: string | Date;
}
export declare function validateBet(bet: BetData): ValidationResult;
/**
 * Sanitize and normalize bet result
 */
export declare function normalizeBetResult(result: boolean | string): boolean;
