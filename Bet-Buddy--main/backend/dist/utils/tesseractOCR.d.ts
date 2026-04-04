/**
 * Tesseract.js OCR Tool
 * Extracts text from betting screenshots using Tesseract.js (open-source, no external API required)
 */
export interface OCRResult {
    rawText: string;
    lines: string[];
    extractedOdds: ExtractedOdds[];
    confidence: number;
}
export interface ExtractedOdds {
    text: string;
    value: number | null;
    format: "american" | "decimal" | "fractional" | "unknown";
    confidence: number;
}
/**
 * Extract text from image using Tesseract.js OCR
 * This is a fully open-source solution that runs locally - no external API keys required
 *
 * Note: On first run, Tesseract.js downloads language data (~15MB) from CDN.
 * Subsequent runs use cached data for faster processing.
 */
export declare function extractTextFromImage(imageBuffer: Buffer): Promise<OCRResult>;
/**
 * Parse odds and return in a standardized format
 */
export declare function parseOddsFromOCR(ocrResult: OCRResult): {
    odds: Array<{
        original: string;
        decimal: number;
        format: string;
    }>;
    suggestions: string[];
};
