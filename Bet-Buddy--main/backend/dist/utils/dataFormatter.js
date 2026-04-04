"use strict";
/**
 * Data Formatter Tool
 * Format betting data for display
 * No external dependencies - pure TypeScript implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.formatPercentage = formatPercentage;
exports.formatOdds = formatOdds;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.formatRelativeTime = formatRelativeTime;
exports.formatNumber = formatNumber;
exports.formatStreak = formatStreak;
exports.formatProfitLoss = formatProfitLoss;
exports.formatROI = formatROI;
exports.truncateText = truncateText;
/**
 * Format currency with symbol and decimal places
 */
function formatCurrency(amount, currency = "USD", locale = "en-US") {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
    }).format(amount);
}
/**
 * Format percentage with specified decimal places
 */
function formatPercentage(value, decimalPlaces = 2, includeSign = false) {
    const formatted = value.toFixed(decimalPlaces);
    const sign = includeSign && value > 0 ? "+" : "";
    return `${sign}${formatted}%`;
}
/**
 * Format odds for display
 */
function formatOdds(odds, format = "decimal") {
    if (format === "decimal") {
        return odds.toFixed(2);
    }
    else if (format === "american") {
        const sign = odds > 0 ? "+" : "";
        return `${sign}${Math.round(odds)}`;
    }
    else {
        // Fractional format
        return odds.toString();
    }
}
/**
 * Format date in various styles
 */
function formatDate(date, style = "medium", locale = "en-US") {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const optionsMap = {
        short: { year: "numeric", month: "numeric", day: "numeric" },
        medium: { year: "numeric", month: "short", day: "numeric" },
        long: { year: "numeric", month: "long", day: "numeric" },
        full: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
    };
    const options = optionsMap[style];
    return new Intl.DateTimeFormat(locale, options).format(dateObj);
}
/**
 * Format date with time
 */
function formatDateTime(date, locale = "en-US", includeSeconds = false) {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const options = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        ...(includeSeconds && { second: "numeric" }),
    };
    return new Intl.DateTimeFormat(locale, options).format(dateObj);
}
/**
 * Format relative time (e.g., "2 days ago", "in 3 hours")
 */
function formatRelativeTime(date, locale = "en-US") {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (Math.abs(diffYear) >= 1) {
        return rtf.format(-diffYear, "year");
    }
    else if (Math.abs(diffMonth) >= 1) {
        return rtf.format(-diffMonth, "month");
    }
    else if (Math.abs(diffWeek) >= 1) {
        return rtf.format(-diffWeek, "week");
    }
    else if (Math.abs(diffDay) >= 1) {
        return rtf.format(-diffDay, "day");
    }
    else if (Math.abs(diffHour) >= 1) {
        return rtf.format(-diffHour, "hour");
    }
    else if (Math.abs(diffMin) >= 1) {
        return rtf.format(-diffMin, "minute");
    }
    else {
        return rtf.format(-diffSec, "second");
    }
}
/**
 * Format large numbers with abbreviations (K, M, B)
 */
function formatNumber(value, decimals = 1, abbreviate = true) {
    if (!abbreviate) {
        return value.toLocaleString();
    }
    const absValue = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (absValue >= 1e9) {
        return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
    }
    else if (absValue >= 1e6) {
        return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
    }
    else if (absValue >= 1e3) {
        return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
    }
    else {
        return value.toFixed(decimals);
    }
}
/**
 * Format win/lose streak
 */
function formatStreak(type, count) {
    if (count === 0)
        return "No streak";
    const emoji = type === "win" ? "🔥" : "❄️";
    return `${emoji} ${count} ${type}${count !== 1 ? "s" : ""}`;
}
/**
 * Format profit/loss with color indication
 */
function formatProfitLoss(amount, includeColor = false) {
    const formatted = formatCurrency(amount);
    const color = amount > 0 ? "green" : amount < 0 ? "red" : "gray";
    if (includeColor) {
        return { value: formatted, color };
    }
    return { value: formatted };
}
/**
 * Format ROI with indication
 */
function formatROI(roi) {
    const formatted = formatPercentage(roi, 2, true);
    const indicator = roi > 0 ? "📈" : roi < 0 ? "📉" : "➡️";
    return { value: formatted, indicator };
}
/**
 * Truncate text to specified length
 */
function truncateText(text, maxLength, ellipsis = "...") {
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}
//# sourceMappingURL=dataFormatter.js.map