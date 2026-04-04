"use strict";
/**
 * OCR API Routes
 * Handles screenshot upload and text extraction using Tesseract.js (open-source OCR)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const tesseractOCR_1 = require("../utils/tesseractOCR");
const router = (0, express_1.Router)();
// Configure multer for memory storage (no disk writes)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (_req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("Only image files are allowed"));
        }
    },
});
/**
 * POST /api/ocr/extract
 * Upload a screenshot and extract text and odds
 */
router.post("/extract", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No image file provided" });
            return;
        }
        // Extract text from image using Tesseract.js
        const ocrResult = await (0, tesseractOCR_1.extractTextFromImage)(req.file.buffer);
        // Parse odds from extracted text
        const parsed = (0, tesseractOCR_1.parseOddsFromOCR)(ocrResult);
        res.json({
            success: true,
            rawText: ocrResult.rawText,
            lines: ocrResult.lines,
            extractedOdds: ocrResult.extractedOdds,
            confidence: ocrResult.confidence,
            parsedOdds: parsed.odds,
            suggestions: parsed.suggestions,
        });
    }
    catch (error) {
        console.error("OCR extraction error:", error);
        res.status(500).json({
            error: "Failed to process image",
            message: error.message,
        });
    }
});
/**
 * GET /api/ocr/status
 * Check if OCR service is available (always true for Tesseract.js since it's local)
 */
router.get("/status", (_req, res) => {
    res.json({
        configured: true,
        service: "Tesseract.js (Open Source)",
        message: "OCR service is ready - no external API keys required",
    });
});
/**
 * GET /api/ocr
 * OCR API information
 */
router.get("/", (_req, res) => {
    res.json({
        message: "Bet Buddy OCR API - Tesseract.js (Open Source)",
        version: "1.0.0",
        endpoints: {
            extract: "POST /api/ocr/extract - Upload screenshot to extract odds",
            status: "GET /api/ocr/status - Check if OCR is configured",
        },
        usage: {
            endpoint: "/api/ocr/extract",
            method: "POST",
            contentType: "multipart/form-data",
            field: "image",
            maxFileSize: "10MB",
            acceptedFormats: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        },
        features: {
            noApiKeyRequired: true,
            offlineCapable: true,
            openSource: true,
            engine: "Tesseract.js v5",
        },
    });
});
exports.default = router;
//# sourceMappingURL=ocr.js.map