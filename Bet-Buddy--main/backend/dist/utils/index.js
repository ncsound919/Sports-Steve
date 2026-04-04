"use strict";
/**
 * Overlay Odds Utility Tools
 * Collection of tools to enhance betting tracking functionality
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Odds Calculator - Convert between odds formats and calculate returns
__exportStar(require("./oddsCalculator"), exports);
// Statistics Engine - Calculate betting performance metrics
__exportStar(require("./statisticsEngine"), exports);
// Data Validator - Validate betting data inputs
__exportStar(require("./dataValidator"), exports);
// Data Exporter - Export data to various formats
__exportStar(require("./dataExporter"), exports);
// Data Formatter - Format data for display
__exportStar(require("./dataFormatter"), exports);
// Tesseract OCR - Extract text and odds from screenshots (open-source, no API key required)
__exportStar(require("./tesseractOCR"), exports);
// Bankroll Manager - Calculate stakes and manage bankroll responsibly
__exportStar(require("./bankrollManager"), exports);
// Azure OCR - removed (missing module, not required for core betting tools)
//# sourceMappingURL=index.js.map