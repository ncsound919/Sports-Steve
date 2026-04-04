"use strict";
/**
 * Games and SimVC API Routes
 * Handles game-related operations and virtual currency management
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// In-memory storage (would be replaced with database in production)
const userBalances = new Map();
const gameResults = new Map();
// Initialize default balance for new users
const DEFAULT_BALANCE = 1000;
/**
 * GET /api/games
 * Get list of available games
 */
router.get("/", (_req, res) => {
    res.json({
        games: [
            {
                id: "basketball-classic",
                name: "Hoops Classic",
                sport: "basketball",
                description: "Bulls vs Blazers / Double Dribble style basketball simulation",
                isFree: true,
                cost: 0,
            },
            {
                id: "football-showdown",
                name: "Gridiron Showdown",
                sport: "football",
                description: "Tecmo Bowl style football simulation",
                isFree: false,
                cost: 500,
            },
            {
                id: "baseball-legends",
                name: "Diamond Legends",
                sport: "baseball",
                description: "Classic baseball simulation with full gameplay",
                isFree: false,
                cost: 500,
            },
        ],
    });
});
/**
 * GET /api/games/simvc/balance
 * Get user's SimVC balance
 */
router.get("/simvc/balance", (req, res) => {
    const userId = req.headers["x-user-id"] || "default";
    if (!userBalances.has(userId)) {
        userBalances.set(userId, DEFAULT_BALANCE);
    }
    res.json({
        balance: userBalances.get(userId),
        lastUpdated: new Date().toISOString(),
    });
});
/**
 * POST /api/games/simvc/add
 * Add SimVC to user's balance
 */
router.post("/simvc/add", (req, res) => {
    const userId = req.headers["x-user-id"] || "default";
    const { amount, description } = req.body;
    if (!amount || amount <= 0) {
        res.status(400).json({ error: "Valid amount is required" });
        return;
    }
    const currentBalance = userBalances.get(userId) || DEFAULT_BALANCE;
    const newBalance = currentBalance + amount;
    userBalances.set(userId, newBalance);
    res.json({
        success: true,
        previousBalance: currentBalance,
        newBalance,
        amount,
        description: description || "SimVC added",
    });
});
/**
 * POST /api/games/simvc/spend
 * Spend SimVC from user's balance
 */
router.post("/simvc/spend", (req, res) => {
    const userId = req.headers["x-user-id"] || "default";
    const { amount, description, gameId } = req.body;
    if (!amount || amount <= 0) {
        res.status(400).json({ error: "Valid amount is required" });
        return;
    }
    const currentBalance = userBalances.get(userId) || DEFAULT_BALANCE;
    if (currentBalance < amount) {
        res.status(400).json({ error: "Insufficient SimVC balance" });
        return;
    }
    const newBalance = currentBalance - amount;
    userBalances.set(userId, newBalance);
    res.json({
        success: true,
        previousBalance: currentBalance,
        newBalance,
        amount,
        description: description || "SimVC spent",
        gameId,
    });
});
/**
 * POST /api/games/bet
 * Place a bet on a game
 */
router.post("/bet", (req, res) => {
    const userId = req.headers["x-user-id"] || "default";
    const { gameId, sport, betType, selection, amount, odds } = req.body;
    if (!gameId || !sport || !selection || !amount || !odds) {
        res.status(400).json({ error: "Missing required bet parameters" });
        return;
    }
    const currentBalance = userBalances.get(userId) || DEFAULT_BALANCE;
    if (currentBalance < amount) {
        res.status(400).json({ error: "Insufficient SimVC balance" });
        return;
    }
    const newBalance = currentBalance - amount;
    userBalances.set(userId, newBalance);
    const betId = `bet-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const potentialPayout = Math.round(amount * odds);
    res.json({
        success: true,
        betId,
        gameId,
        sport,
        betType: betType || "moneyline",
        selection,
        amount,
        odds,
        potentialPayout,
        status: "pending",
        balance: newBalance,
    });
});
/**
 * POST /api/games/bet/resolve
 * Resolve a bet outcome
 */
router.post("/bet/resolve", (req, res) => {
    const userId = req.headers["x-user-id"] || "default";
    const { betId, won, potentialPayout } = req.body;
    if (betId === undefined || won === undefined) {
        res.status(400).json({ error: "betId and won status are required" });
        return;
    }
    const currentBalance = userBalances.get(userId) || DEFAULT_BALANCE;
    let newBalance = currentBalance;
    if (won && potentialPayout) {
        newBalance = currentBalance + potentialPayout;
        userBalances.set(userId, newBalance);
    }
    // Store game result
    const results = gameResults.get(userId) || [];
    results.push({
        gameId: betId,
        result: won ? "won" : "lost",
        timestamp: new Date(),
    });
    gameResults.set(userId, results.slice(-100)); // Keep last 100 results
    res.json({
        success: true,
        betId,
        won,
        payout: won ? potentialPayout : 0,
        balance: newBalance,
    });
});
/**
 * GET /api/games/history
 * Get user's game history
 */
router.get("/history", (req, res) => {
    const userId = req.headers["x-user-id"] || "default";
    const results = gameResults.get(userId) || [];
    const wins = results.filter((r) => r.result === "won").length;
    const losses = results.filter((r) => r.result === "lost").length;
    res.json({
        history: results.slice(-20), // Last 20 results
        stats: {
            totalGames: results.length,
            wins,
            losses,
            winRate: results.length > 0 ? ((wins / results.length) * 100).toFixed(1) : 0,
        },
    });
});
/**
 * POST /api/games/unlock
 * Unlock a game using SimVC
 */
router.post("/unlock", (req, res) => {
    const userId = req.headers["x-user-id"] || "default";
    const { gameId, cost } = req.body;
    if (!gameId || cost === undefined) {
        res.status(400).json({ error: "gameId and cost are required" });
        return;
    }
    const currentBalance = userBalances.get(userId) || DEFAULT_BALANCE;
    if (currentBalance < cost) {
        res.status(400).json({ error: "Insufficient SimVC to unlock game" });
        return;
    }
    const newBalance = currentBalance - cost;
    userBalances.set(userId, newBalance);
    res.json({
        success: true,
        gameId,
        cost,
        balance: newBalance,
        message: `Game ${gameId} unlocked successfully!`,
    });
});
exports.default = router;
//# sourceMappingURL=games.js.map