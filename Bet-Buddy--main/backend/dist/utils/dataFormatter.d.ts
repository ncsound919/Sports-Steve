/**
 * Data Formatter Tool
 * Format betting data for display
 * No external dependencies - pure TypeScript implementation
 */
/**
 * Format currency with symbol and decimal places
 */
export declare function formatCurrency(amount: number, currency?: string, locale?: string): string;
/**
 * Format percentage with specified decimal places
 */
export declare function formatPercentage(value: number, decimalPlaces?: number, includeSign?: boolean): string;
/**
 * Format odds for display
 */
export declare function formatOdds(odds: number, format?: "decimal" | "american" | "fractional"): string;
/**
 * Format date in various styles
 */
export declare function formatDate(date: Date | string, style?: "short" | "medium" | "long" | "full", locale?: string): string;
/**
 * Format date with time
 */
export declare function formatDateTime(date: Date | string, locale?: string, includeSeconds?: boolean): string;
/**
 * Format relative time (e.g., "2 days ago", "in 3 hours")
 */
export declare function formatRelativeTime(date: Date | string, locale?: string): string;
/**
 * Format large numbers with abbreviations (K, M, B)
 */
export declare function formatNumber(value: number, decimals?: number, abbreviate?: boolean): string;
/**
 * Format win/lose streak
 */
export declare function formatStreak(type: "win" | "lose", count: number): string;
/**
 * Format profit/loss with color indication
 */
export declare function formatProfitLoss(amount: number, includeColor?: boolean): {
    value: string;
    color?: string;
};
/**
 * Format ROI with indication
 */
export declare function formatROI(roi: number): {
    value: string;
    indicator: string;
};
/**
 * Truncate text to specified length
 */
export declare function truncateText(text: string, maxLength: number, ellipsis?: string): string;
