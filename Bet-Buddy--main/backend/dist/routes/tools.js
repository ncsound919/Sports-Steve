"use strict";
/**
 * Tools API Routes
 * Exposes utility tools as API endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bankrollManager_1 = require("../utils/bankrollManager");
const dataExporter_1 = require("../utils/dataExporter");
const dataFormatter_1 = require("../utils/dataFormatter");
const dataValidator_1 = require("../utils/dataValidator");
const oddsCalculator_1 = require("../utils/oddsCalculator");
const statisticsEngine_1 = require("../utils/statisticsEngine");
const router = (0, express_1.Router)();
// Odds Calculator Endpoints
router.post("/odds/convert/decimal", (req, res) => {
    try {
        const { decimal } = req.body;
        if (!decimal) {
            res.status(400).json({ error: "Decimal odds value is required" });
            return;
        }
        const result = (0, oddsCalculator_1.convertFromDecimal)(Number(decimal));
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/odds/convert/american", (req, res) => {
    try {
        const { american } = req.body;
        if (!american) {
            res.status(400).json({ error: "American odds value is required" });
            return;
        }
        const result = (0, oddsCalculator_1.convertFromAmerican)(Number(american));
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/odds/convert/fractional", (req, res) => {
    try {
        const { fractional } = req.body;
        if (!fractional) {
            res.status(400).json({ error: "Fractional odds value is required" });
            return;
        }
        const result = (0, oddsCalculator_1.convertFromFractional)(String(fractional));
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/odds/calculate-return", (req, res) => {
    try {
        const { stake, odds, format = "decimal" } = req.body;
        if (!stake || !odds) {
            res.status(400).json({ error: "Stake and odds are required" });
            return;
        }
        const result = (0, oddsCalculator_1.calculateReturn)(Number(stake), Number(odds), format);
        res.json({ stake, odds, format, return: result, profit: result - Number(stake) });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/odds/calculate-profit", (req, res) => {
    try {
        const { stake, odds, format = "decimal" } = req.body;
        if (!stake || !odds) {
            res.status(400).json({ error: "Stake and odds are required" });
            return;
        }
        const result = (0, oddsCalculator_1.calculateProfit)(Number(stake), Number(odds), format);
        res.json({ stake, odds, format, profit: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Statistics Engine Endpoints
router.post("/statistics/calculate", (req, res) => {
    try {
        const { bets } = req.body;
        if (!Array.isArray(bets)) {
            res.status(400).json({ error: "Bets array is required" });
            return;
        }
        const result = (0, statisticsEngine_1.calculateStatistics)(bets);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/statistics/kelly-criterion", (req, res) => {
    try {
        const { winProbability, odds } = req.body;
        if (!winProbability || !odds) {
            res.status(400).json({ error: "Win probability and odds are required" });
            return;
        }
        const result = (0, statisticsEngine_1.calculateKellyCriterion)(Number(winProbability), Number(odds));
        res.json({
            winProbability,
            odds,
            kellyCriterion: result,
            recommendation: result > 0 ? "Bet recommended" : "No edge - do not bet",
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/statistics/expected-value", (req, res) => {
    try {
        const { stake, winProbability, odds } = req.body;
        if (!stake || !winProbability || !odds) {
            res.status(400).json({ error: "Stake, win probability, and odds are required" });
            return;
        }
        const result = (0, statisticsEngine_1.calculateExpectedValue)(Number(stake), Number(winProbability), Number(odds));
        res.json({
            stake,
            winProbability,
            odds,
            expectedValue: result,
            recommendation: result > 0 ? "Positive expected value" : "Negative expected value",
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Data Validator Endpoints
router.post("/validate/stake", (req, res) => {
    try {
        const { stake, minStake, maxStake } = req.body;
        if (stake === undefined) {
            res.status(400).json({ error: "Stake is required" });
            return;
        }
        const result = (0, dataValidator_1.validateStake)(Number(stake), minStake, maxStake);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/validate/odds", (req, res) => {
    try {
        const { odds, format = "decimal" } = req.body;
        if (odds === undefined) {
            res.status(400).json({ error: "Odds value is required" });
            return;
        }
        const result = (0, dataValidator_1.validateOdds)(odds, format);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/validate/bet", (req, res) => {
    try {
        const betData = req.body;
        if (!betData) {
            res.status(400).json({ error: "Bet data is required" });
            return;
        }
        const result = (0, dataValidator_1.validateBet)(betData);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Data Exporter Endpoints
router.post("/export", (req, res) => {
    try {
        const { bets, format = "json" } = req.body;
        if (!Array.isArray(bets)) {
            res.status(400).json({ error: "Bets array is required" });
            return;
        }
        const result = (0, dataExporter_1.exportData)(bets, format);
        // Set appropriate content type
        const contentTypes = {
            csv: "text/csv",
            json: "application/json",
            jsonlines: "application/x-ndjson",
            tsv: "text/tab-separated-values",
            html: "text/html",
            markdown: "text/markdown",
        };
        res.set("Content-Type", contentTypes[format] || "text/plain");
        res.send(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Data Formatter Endpoints
router.post("/format/currency", (req, res) => {
    try {
        const { amount, currency = "USD", locale = "en-US" } = req.body;
        if (amount === undefined) {
            res.status(400).json({ error: "Amount is required" });
            return;
        }
        const result = (0, dataFormatter_1.formatCurrency)(Number(amount), currency, locale);
        res.json({ original: amount, formatted: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/format/percentage", (req, res) => {
    try {
        const { value, decimalPlaces = 2, includeSign = false } = req.body;
        if (value === undefined) {
            res.status(400).json({ error: "Value is required" });
            return;
        }
        const result = (0, dataFormatter_1.formatPercentage)(Number(value), decimalPlaces, includeSign);
        res.json({ original: value, formatted: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/format/odds", (req, res) => {
    try {
        const { odds, format = "decimal" } = req.body;
        if (odds === undefined) {
            res.status(400).json({ error: "Odds value is required" });
            return;
        }
        const result = (0, dataFormatter_1.formatOdds)(Number(odds), format);
        res.json({ original: odds, format, formatted: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/format/date", (req, res) => {
    try {
        const { date, style = "medium", locale = "en-US" } = req.body;
        if (!date) {
            res.status(400).json({ error: "Date is required" });
            return;
        }
        const result = (0, dataFormatter_1.formatDate)(date, style, locale);
        res.json({ original: date, formatted: result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Bankroll Management Endpoints
router.post("/bankroll/suggested-stake", (req, res) => {
    try {
        const { bankroll, odds, estimatedWinProbability, riskTolerance = "moderate" } = req.body;
        if (bankroll == null || odds == null || estimatedWinProbability == null) {
            res.status(400).json({ error: "Bankroll, odds, and estimatedWinProbability are required" });
            return;
        }
        const result = (0, bankrollManager_1.calculateSuggestedStake)(Number(bankroll), Number(odds), Number(estimatedWinProbability), riskTolerance);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/bankroll/flat-stake", (req, res) => {
    try {
        const { bankroll, riskTolerance = "moderate" } = req.body;
        if (bankroll == null) {
            res.status(400).json({ error: "Bankroll is required" });
            return;
        }
        const stake = (0, bankrollManager_1.calculateFlatStake)(Number(bankroll), riskTolerance);
        res.json({
            bankroll: Number(bankroll),
            riskTolerance,
            suggestedStake: stake,
            unitsPerBankroll: Math.round(Number(bankroll) / stake),
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/bankroll/unit-size", (req, res) => {
    try {
        const { bankroll, unitsInBankroll = 100 } = req.body;
        if (bankroll == null) {
            res.status(400).json({ error: "Bankroll is required" });
            return;
        }
        const unitSize = (0, bankrollManager_1.calculateUnitSize)(Number(bankroll), Number(unitsInBankroll));
        res.json({
            bankroll: Number(bankroll),
            unitsInBankroll: Number(unitsInBankroll),
            unitSize,
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/bankroll/check-limits", (req, res) => {
    try {
        const { stake, config, currentDailyWagered = 0, currentWeeklyWagered = 0, currentMonthlyWagered = 0, } = req.body;
        if (stake == null || config == null) {
            res.status(400).json({ error: "Stake and config are required" });
            return;
        }
        const result = (0, bankrollManager_1.checkBettingLimits)(Number(stake), config, Number(currentDailyWagered), Number(currentWeeklyWagered), Number(currentMonthlyWagered));
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/bankroll/stop-levels", (req, res) => {
    try {
        const { bankroll, riskTolerance = "moderate" } = req.body;
        if (bankroll == null) {
            res.status(400).json({ error: "Bankroll is required" });
            return;
        }
        const result = (0, bankrollManager_1.calculateStopLevels)(Number(bankroll), riskTolerance);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get("/bankroll/responsible-gambling", (_req, res) => {
    try {
        const tips = (0, bankrollManager_1.getResponsibleGamblingTips)();
        res.json(tips);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post("/bankroll/evaluate-session", (req, res) => {
    try {
        const { recentResults, bankroll, originalBankroll } = req.body;
        if (!recentResults || bankroll === undefined || originalBankroll === undefined) {
            res.status(400).json({ error: "recentResults, bankroll, and originalBankroll are required" });
            return;
        }
        const result = (0, bankrollManager_1.evaluateBettingSession)(recentResults, Number(bankroll), Number(originalBankroll));
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// Tools listing endpoint
router.get("/", (_req, res) => {
    res.json({
        message: "Overlay Odds Tools API",
        version: "1.0.0",
        tools: {
            oddsCalculator: {
                endpoints: [
                    "POST /api/tools/odds/convert/decimal",
                    "POST /api/tools/odds/convert/american",
                    "POST /api/tools/odds/convert/fractional",
                    "POST /api/tools/odds/calculate-return",
                    "POST /api/tools/odds/calculate-profit",
                ],
            },
            statisticsEngine: {
                endpoints: [
                    "POST /api/tools/statistics/calculate",
                    "POST /api/tools/statistics/kelly-criterion",
                    "POST /api/tools/statistics/expected-value",
                ],
            },
            dataValidator: {
                endpoints: [
                    "POST /api/tools/validate/stake",
                    "POST /api/tools/validate/odds",
                    "POST /api/tools/validate/bet",
                ],
            },
            dataExporter: {
                endpoints: ["POST /api/tools/export"],
                supportedFormats: ["csv", "json", "jsonlines", "tsv", "html", "markdown"],
            },
            dataFormatter: {
                endpoints: [
                    "POST /api/tools/format/currency",
                    "POST /api/tools/format/percentage",
                    "POST /api/tools/format/odds",
                    "POST /api/tools/format/date",
                ],
            },
            bankrollManager: {
                endpoints: [
                    "POST /api/tools/bankroll/suggested-stake",
                    "POST /api/tools/bankroll/flat-stake",
                    "POST /api/tools/bankroll/unit-size",
                    "POST /api/tools/bankroll/check-limits",
                    "POST /api/tools/bankroll/stop-levels",
                    "GET /api/tools/bankroll/responsible-gambling",
                    "POST /api/tools/bankroll/evaluate-session",
                ],
                description: "Bankroll management and responsible gambling tools",
            },
        },
    });
});
exports.default = router;
//# sourceMappingURL=tools.js.map