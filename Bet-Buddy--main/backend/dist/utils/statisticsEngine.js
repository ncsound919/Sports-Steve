"use strict";
/**
 * Statistics Engine Tool
 * Calculates betting statistics and performance metrics
 * No external dependencies - pure TypeScript implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateStatistics = calculateStatistics;
exports.calculateStatisticsByPeriod = calculateStatisticsByPeriod;
exports.calculateKellyCriterion = calculateKellyCriterion;
exports.calculateExpectedValue = calculateExpectedValue;
/**
 * Calculate comprehensive betting statistics
 */
function calculateStatistics(bets) {
    if (bets.length === 0) {
        return {
            totalBets: 0,
            totalStake: 0,
            totalReturns: 0,
            profit: 0,
            roi: 0,
            winRate: 0,
            averageStake: 0,
            averageOdds: 0,
            longestWinStreak: 0,
            longestLoseStreak: 0,
            currentStreak: { type: "none", count: 0 },
        };
    }
    const totalBets = bets.length;
    const totalStake = bets.reduce((sum, bet) => sum + bet.stake, 0);
    const wonBets = bets.filter((bet) => bet.won);
    const totalReturns = wonBets.reduce((sum, bet) => sum + bet.stake * bet.odds, 0);
    const profit = totalReturns - totalStake;
    const roi = (profit / totalStake) * 100;
    const winRate = (wonBets.length / totalBets) * 100;
    const averageStake = totalStake / totalBets;
    const averageOdds = bets.reduce((sum, bet) => sum + bet.odds, 0) / totalBets;
    // Calculate streaks
    const streaks = calculateStreaks(bets);
    return {
        totalBets,
        totalStake: parseFloat(totalStake.toFixed(2)),
        totalReturns: parseFloat(totalReturns.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        roi: parseFloat(roi.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(2)),
        averageStake: parseFloat(averageStake.toFixed(2)),
        averageOdds: parseFloat(averageOdds.toFixed(2)),
        longestWinStreak: streaks.longestWin,
        longestLoseStreak: streaks.longestLose,
        currentStreak: streaks.current,
    };
}
/**
 * Calculate win/lose streaks
 */
function calculateStreaks(bets) {
    if (bets.length === 0) {
        return {
            longestWin: 0,
            longestLose: 0,
            current: { type: "none", count: 0 },
        };
    }
    let longestWin = 0;
    let longestLose = 0;
    let currentWinStreak = 0;
    let currentLoseStreak = 0;
    for (const bet of bets) {
        if (bet.won) {
            currentWinStreak++;
            currentLoseStreak = 0;
            longestWin = Math.max(longestWin, currentWinStreak);
        }
        else {
            currentLoseStreak++;
            currentWinStreak = 0;
            longestLose = Math.max(longestLose, currentLoseStreak);
        }
    }
    const current = currentWinStreak > 0
        ? { type: "win", count: currentWinStreak }
        : currentLoseStreak > 0
            ? { type: "lose", count: currentLoseStreak }
            : { type: "none", count: 0 };
    return {
        longestWin,
        longestLose,
        current,
    };
}
/**
 * Calculate statistics for a specific time period
 */
function calculateStatisticsByPeriod(bets, startDate, endDate) {
    const filteredBets = bets.filter((bet) => {
        if (!bet.date)
            return false;
        const betDate = new Date(bet.date);
        return betDate >= startDate && betDate <= endDate;
    });
    return calculateStatistics(filteredBets);
}
/**
 * Calculate Kelly Criterion for optimal bet sizing
 * Returns the fraction of bankroll to bet (0-1)
 *
 * Formula: f* = (bp - q) / b
 * Where:
 *   f* = fraction of bankroll to bet
 *   b = net odds (decimal odds - 1)
 *   p = win probability
 *   q = lose probability (1 - p)
 */
function calculateKellyCriterion(winProbability, odds) {
    if (winProbability <= 0 || winProbability >= 1) {
        throw new Error("Win probability must be between 0 and 1");
    }
    if (odds <= 1) {
        throw new Error("Odds must be greater than 1");
    }
    const q = 1 - winProbability; // Lose probability
    const b = odds - 1; // Net odds
    // Kelly formula: f* = (bp - q) / b
    const kellyCriterion = (b * winProbability - q) / b;
    // Return 0 if negative (no edge)
    return Math.max(0, parseFloat(kellyCriterion.toFixed(4)));
}
/**
 * Calculate expected value of a bet
 */
function calculateExpectedValue(stake, winProbability, odds) {
    if (winProbability < 0 || winProbability > 1) {
        throw new Error("Win probability must be between 0 and 1");
    }
    const winAmount = stake * odds - stake;
    const loseAmount = -stake;
    const ev = winProbability * winAmount + (1 - winProbability) * loseAmount;
    return parseFloat(ev.toFixed(2));
}
//# sourceMappingURL=statisticsEngine.js.map