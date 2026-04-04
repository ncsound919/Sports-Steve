/**
 * Odds Calculator Tool
 * Converts between different odds formats and calculates probabilities
 * No external dependencies - pure TypeScript implementation
 */
export interface OddsConversion {
    decimal: number;
    fractional: string;
    american: number;
    impliedProbability: number;
}
/**
 * Convert decimal odds to all formats
 */
export declare function convertFromDecimal(decimal: number): OddsConversion;
/**
 * Convert American odds to all formats
 */
export declare function convertFromAmerican(american: number): OddsConversion;
/**
 * Convert fractional odds (e.g., "5/2") to all formats
 */
export declare function convertFromFractional(fractional: string): OddsConversion;
/**
 * Calculate potential return from stake and odds
 */
export declare function calculateReturn(stake: number, odds: number, format?: "decimal" | "american" | "fractional"): number;
/**
 * Calculate profit from stake and odds
 */
export declare function calculateProfit(stake: number, odds: number, format?: "decimal" | "american" | "fractional"): number;
