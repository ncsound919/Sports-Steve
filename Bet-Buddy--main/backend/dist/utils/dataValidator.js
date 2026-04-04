"use strict";
/**
 * Data Validator Tool
 * Validates betting data inputs
 * No external dependencies - pure TypeScript implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStake = validateStake;
exports.validateOdds = validateOdds;
exports.validateDate = validateDate;
exports.validateBetResult = validateBetResult;
exports.validateBet = validateBet;
exports.normalizeBetResult = normalizeBetResult;
/**
 * Validate bet stake amount
 */
function validateStake(stake, minStake = 0.01, maxStake = 1000000) {
    const errors = [];
    if (typeof stake !== "number" || isNaN(stake)) {
        errors.push("Stake must be a valid number");
    }
    else if (stake < minStake) {
        errors.push(`Stake must be at least ${minStake}`);
    }
    else if (stake > maxStake) {
        errors.push(`Stake must not exceed ${maxStake}`);
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Validate odds value
 */
function validateOdds(odds, format = "decimal") {
    const errors = [];
    if (format === "decimal") {
        const oddsNum = Number(odds);
        if (typeof oddsNum !== "number" || isNaN(oddsNum)) {
            errors.push("Decimal odds must be a valid number");
        }
        else if (oddsNum < 1) {
            errors.push("Decimal odds must be 1.00 or greater");
        }
        else if (oddsNum > 1000) {
            errors.push("Decimal odds seem unreasonably high (>1000)");
        }
    }
    else if (format === "american") {
        const oddsNum = Number(odds);
        if (typeof oddsNum !== "number" || isNaN(oddsNum)) {
            errors.push("American odds must be a valid number");
        }
        else if (oddsNum === 0 || (oddsNum > -100 && oddsNum < 100)) {
            errors.push("American odds must be <= -100 or >= 100");
        }
    }
    else if (format === "fractional") {
        const oddsStr = String(odds);
        const parts = oddsStr.split("/");
        if (parts.length !== 2) {
            errors.push('Fractional odds must be in format "numerator/denominator"');
        }
        else {
            const numerator = parseFloat(parts[0]);
            const denominator = parseFloat(parts[1]);
            if (isNaN(numerator) || isNaN(denominator)) {
                errors.push("Fractional odds must contain valid numbers");
            }
            else if (denominator === 0) {
                errors.push("Denominator cannot be zero");
            }
            else if (numerator < 0 || denominator < 0) {
                errors.push("Fractional odds cannot be negative");
            }
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Validate date string or Date object
 */
function validateDate(date) {
    const errors = [];
    try {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            errors.push("Invalid date format");
        }
        else if (dateObj > new Date()) {
            errors.push("Date cannot be in the future");
        }
    }
    catch {
        errors.push("Invalid date");
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
// Valid result values for bet outcomes
const VALID_RESULT_VALUES = ["won", "lost", "win", "lose", "true", "false", "yes", "no"];
const WINNING_RESULT_VALUES = ["won", "win", "true", "yes"];
/**
 * Validate bet result (won/lost)
 */
function validateBetResult(result) {
    const errors = [];
    if (typeof result === "boolean") {
        // Valid
    }
    else if (typeof result === "string") {
        const normalized = result.toLowerCase();
        if (!VALID_RESULT_VALUES.includes(normalized)) {
            errors.push("Bet result must be won/lost, win/lose, yes/no, or true/false");
        }
    }
    else {
        errors.push("Bet result must be a boolean or string");
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
function validateBet(bet) {
    const errors = [];
    // Validate stake
    const stakeValidation = validateStake(bet.stake);
    if (!stakeValidation.isValid) {
        errors.push(...stakeValidation.errors);
    }
    // Validate odds
    const oddsFormat = bet.oddsFormat || "decimal";
    const oddsValidation = validateOdds(bet.odds, oddsFormat);
    if (!oddsValidation.isValid) {
        errors.push(...oddsValidation.errors);
    }
    // Validate result
    const resultValidation = validateBetResult(bet.result);
    if (!resultValidation.isValid) {
        errors.push(...resultValidation.errors);
    }
    // Validate date if provided
    if (bet.date) {
        const dateValidation = validateDate(bet.date);
        if (!dateValidation.isValid) {
            errors.push(...dateValidation.errors);
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Sanitize and normalize bet result
 */
function normalizeBetResult(result) {
    if (typeof result === "boolean") {
        return result;
    }
    const normalized = result.toLowerCase();
    return WINNING_RESULT_VALUES.includes(normalized);
}
//# sourceMappingURL=dataValidator.js.map