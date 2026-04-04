"use strict";
/**
 * Bankroll Management Tool
 * Calculate stake sizes based on bankroll and risk tolerance
 * Promote responsible gambling with betting limits
 * No external dependencies - pure TypeScript implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSuggestedStake = calculateSuggestedStake;
exports.calculateFlatStake = calculateFlatStake;
exports.calculateUnitSize = calculateUnitSize;
exports.checkBettingLimits = checkBettingLimits;
exports.calculateStopLevels = calculateStopLevels;
exports.getResponsibleGamblingTips = getResponsibleGamblingTips;
exports.evaluateBettingSession = evaluateBettingSession;
/**
 * Risk tolerance multipliers for stake calculation
 */
const RISK_MULTIPLIERS = {
    conservative: 0.01, // 1% of bankroll per bet
    moderate: 0.02, // 2% of bankroll per bet
    aggressive: 0.05, // 5% of bankroll per bet
};
/**
 * Maximum stake multiplier - allows up to 2x the base risk percentage
 * This caps aggressive staking to prevent excessive risk
 */
const MAX_STAKE_MULTIPLIER = 2;
/**
 * Calculate suggested stake based on Kelly Criterion and risk tolerance
 * Uses a fractional Kelly approach for safety
 */
function calculateSuggestedStake(bankroll, odds, estimatedWinProbability, riskTolerance = "moderate") {
    if (bankroll <= 0) {
        throw new Error("Bankroll must be greater than 0");
    }
    if (odds <= 1) {
        throw new Error("Odds must be greater than 1");
    }
    if (estimatedWinProbability <= 0 || estimatedWinProbability >= 1) {
        throw new Error("Estimated win probability must be between 0 and 1 (exclusive)");
    }
    // Calculate full Kelly stake
    const b = odds - 1; // Net odds
    const p = estimatedWinProbability;
    const q = 1 - p;
    const fullKelly = (b * p - q) / b;
    // Apply fractional Kelly based on risk tolerance
    const fractionMap = {
        conservative: 0.25, // Quarter Kelly
        moderate: 0.5, // Half Kelly
        aggressive: 0.75, // Three-quarter Kelly
    };
    const kellyFraction = fractionMap[riskTolerance] || 0.5;
    let suggestedStake = fullKelly > 0 ? bankroll * fullKelly * kellyFraction : 0;
    // Apply maximum stake limits based on risk tolerance
    const maxMultiplier = RISK_MULTIPLIERS[riskTolerance] || 0.02;
    const maxStake = bankroll * maxMultiplier * MAX_STAKE_MULTIPLIER;
    const minStake = Math.max(1, bankroll * 0.001); // Minimum $1 or 0.1% of bankroll
    // Clamp stake within limits
    suggestedStake = Math.max(minStake, Math.min(maxStake, suggestedStake));
    // Round to 2 decimal places
    suggestedStake = parseFloat(suggestedStake.toFixed(2));
    let reasoning;
    if (fullKelly <= 0) {
        reasoning = "No positive edge detected. Consider skipping this bet or reducing stake.";
        suggestedStake = minStake;
    }
    else if (fullKelly > maxMultiplier * MAX_STAKE_MULTIPLIER) {
        reasoning = `High edge detected, but stake capped at ${(maxMultiplier * MAX_STAKE_MULTIPLIER * 100).toFixed(0)}% of bankroll for safety.`;
    }
    else {
        reasoning = `Based on ${(kellyFraction * 100).toFixed(0)}% Kelly Criterion with ${riskTolerance} risk profile.`;
    }
    return {
        suggestedStake,
        maxStake: parseFloat(maxStake.toFixed(2)),
        minStake: parseFloat(minStake.toFixed(2)),
        riskLevel: riskTolerance,
        reasoning,
    };
}
/**
 * Calculate flat stake based on bankroll and risk tolerance
 * Simple percentage-based staking without Kelly
 */
function calculateFlatStake(bankroll, riskTolerance = "moderate") {
    if (bankroll <= 0) {
        throw new Error("Bankroll must be greater than 0");
    }
    const multiplier = RISK_MULTIPLIERS[riskTolerance] || 0.02;
    const stake = bankroll * multiplier;
    return parseFloat(Math.max(1, stake).toFixed(2));
}
/**
 * Calculate unit size for bankroll management
 * Commonly used for tracking bets in "units"
 */
function calculateUnitSize(bankroll, unitsInBankroll = 100) {
    if (bankroll <= 0) {
        throw new Error("Bankroll must be greater than 0");
    }
    if (unitsInBankroll <= 0) {
        throw new Error("Units in bankroll must be greater than 0");
    }
    return parseFloat((bankroll / unitsInBankroll).toFixed(2));
}
/**
 * Check if a bet exceeds responsible gambling limits
 */
function checkBettingLimits(stake, config, currentDailyWagered = 0, currentWeeklyWagered = 0, currentMonthlyWagered = 0) {
    const warnings = [];
    const violations = [];
    // Check stake against bankroll percentage
    const maxStakePercent = config.maxStakePercentage || 10;
    const maxStake = config.totalBankroll * (maxStakePercent / 100);
    if (stake > maxStake) {
        violations.push(`Stake exceeds ${maxStakePercent}% of bankroll ($${maxStake.toFixed(2)} max)`);
    }
    // Check daily limit
    if (config.dailyLimit !== undefined) {
        if (currentDailyWagered + stake > config.dailyLimit) {
            violations.push(`Bet would exceed daily limit of $${config.dailyLimit.toFixed(2)}`);
        }
        else if (currentDailyWagered + stake > config.dailyLimit * 0.8) {
            warnings.push("Approaching daily betting limit (>80%)");
        }
    }
    // Check weekly limit
    if (config.weeklyLimit !== undefined) {
        if (currentWeeklyWagered + stake > config.weeklyLimit) {
            violations.push(`Bet would exceed weekly limit of $${config.weeklyLimit.toFixed(2)}`);
        }
        else if (currentWeeklyWagered + stake > config.weeklyLimit * 0.8) {
            warnings.push("Approaching weekly betting limit (>80%)");
        }
    }
    // Check monthly limit
    if (config.monthlyLimit !== undefined) {
        if (currentMonthlyWagered + stake > config.monthlyLimit) {
            violations.push(`Bet would exceed monthly limit of $${config.monthlyLimit.toFixed(2)}`);
        }
        else if (currentMonthlyWagered + stake > config.monthlyLimit * 0.8) {
            warnings.push("Approaching monthly betting limit (>80%)");
        }
    }
    // Check if stake is a large portion of remaining bankroll
    if (stake > config.totalBankroll * 0.25) {
        warnings.push("Stake is more than 25% of total bankroll - high risk!");
    }
    return {
        allowed: violations.length === 0,
        warnings,
        violations,
    };
}
/**
 * Calculate stop-loss and take-profit levels
 */
function calculateStopLevels(bankroll, riskTolerance = "moderate") {
    const stopLossMap = {
        conservative: 0.1, // 10% stop loss
        moderate: 0.2, // 20% stop loss
        aggressive: 0.3, // 30% stop loss
    };
    const takeProfitMap = {
        conservative: 0.15, // 15% take profit
        moderate: 0.3, // 30% take profit
        aggressive: 0.5, // 50% take profit
    };
    const stopLossPercentage = stopLossMap[riskTolerance] || 0.2;
    const takeProfitPercentage = takeProfitMap[riskTolerance] || 0.3;
    const stopLoss = bankroll * (1 - stopLossPercentage);
    const takeProfit = bankroll * (1 + takeProfitPercentage);
    const recommendations = [
        `Stop betting for the day if bankroll drops to $${stopLoss.toFixed(2)}`,
        `Consider taking profits when bankroll reaches $${takeProfit.toFixed(2)}`,
        "Take regular breaks to maintain clear decision-making",
        "Never chase losses - stick to your staking plan",
    ];
    return {
        stopLoss: parseFloat(stopLoss.toFixed(2)),
        stopLossPercentage: stopLossPercentage * 100,
        takeProfit: parseFloat(takeProfit.toFixed(2)),
        takeProfitPercentage: takeProfitPercentage * 100,
        recommendations,
    };
}
/**
 * Get responsible gambling tips and resources
 */
function getResponsibleGamblingTips() {
    return {
        tips: [
            "Set a budget before you start and stick to it",
            "Never bet more than you can afford to lose",
            "Take regular breaks from betting",
            "Do not chase your losses",
            "Balance betting with other activities",
            "Do not bet when under the influence of alcohol or drugs",
            "If gambling stops being fun, stop gambling",
            "Keep track of time and money spent betting",
            "Treat betting as entertainment, not as income",
            "Seek help if you feel gambling is becoming a problem",
        ],
        resources: [
            {
                name: "National Council on Problem Gambling",
                description: "US national helpline and resources for problem gambling",
                url: "https://www.ncpgambling.org/",
            },
            {
                name: "Gamblers Anonymous",
                description: "Fellowship of people who share experience to help recover from gambling addiction",
                url: "https://www.gamblersanonymous.org/",
            },
            {
                name: "GamCare",
                description: "UK support for anyone affected by problem gambling",
                url: "https://www.gamcare.org.uk/",
            },
            {
                name: "BeGambleAware",
                description: "UK charity providing information and support",
                url: "https://www.begambleaware.org/",
            },
        ],
    };
}
/**
 * Evaluate if betting should be paused based on recent results
 */
function evaluateBettingSession(recentResults, bankroll, originalBankroll) {
    if (recentResults.length === 0) {
        return {
            shouldPause: false,
            reason: null,
            recommendation: "Good luck! Remember to bet responsibly.",
        };
    }
    // Check for losing streak
    const lastFive = recentResults.slice(-5);
    const losesInLastFive = lastFive.filter((r) => !r.won).length;
    // Check bankroll change
    const bankrollChange = ((bankroll - originalBankroll) / originalBankroll) * 100;
    if (losesInLastFive >= 4) {
        return {
            shouldPause: true,
            reason: "Lost 4 or more of last 5 bets",
            recommendation: "Consider taking a break. Chasing losses often leads to more losses.",
        };
    }
    if (bankrollChange <= -20) {
        return {
            shouldPause: true,
            reason: "Bankroll down 20% or more",
            recommendation: "Stop-loss threshold reached. Take a break and reassess your strategy.",
        };
    }
    if (bankrollChange >= 30) {
        return {
            shouldPause: false,
            reason: null,
            recommendation: "Great session! Consider locking in some profits by reducing stake or withdrawing.",
        };
    }
    if (losesInLastFive >= 3) {
        return {
            shouldPause: false,
            reason: null,
            recommendation: "Lost 3 of last 5 bets. Consider reducing stake or taking a short break.",
        };
    }
    return {
        shouldPause: false,
        reason: null,
        recommendation: "Session going well. Continue following your staking plan.",
    };
}
//# sourceMappingURL=bankrollManager.js.map