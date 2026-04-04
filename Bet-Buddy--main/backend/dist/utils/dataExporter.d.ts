/**
 * Data Exporter Tool
 * Export betting data to various formats
 * No external dependencies - pure TypeScript implementation
 */
export interface BetRecord {
    id?: string | number;
    date: string | Date;
    stake: number;
    odds: number;
    result: boolean | string;
    profit?: number;
    description?: string;
    [key: string]: unknown;
}
/**
 * Convert bet records to CSV format
 */
export declare function exportToCSV(bets: BetRecord[]): string;
/**
 * Convert bet records to JSON format (pretty printed)
 */
export declare function exportToJSON(bets: BetRecord[]): string;
/**
 * Convert bet records to JSON Lines format (one JSON object per line)
 */
export declare function exportToJSONLines(bets: BetRecord[]): string;
/**
 * Convert bet records to TSV (Tab-Separated Values) format
 */
export declare function exportToTSV(bets: BetRecord[]): string;
/**
 * Convert bet records to HTML table
 */
export declare function exportToHTML(bets: BetRecord[]): string;
/**
 * Export bet records to markdown table format
 */
export declare function exportToMarkdown(bets: BetRecord[]): string;
/**
 * Export with format selection
 */
export declare function exportData(bets: BetRecord[], format?: "csv" | "json" | "jsonlines" | "tsv" | "html" | "markdown"): string;
