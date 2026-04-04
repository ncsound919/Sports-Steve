"use strict";
/**
 * Data Exporter Tool
 * Export betting data to various formats
 * No external dependencies - pure TypeScript implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportToCSV = exportToCSV;
exports.exportToJSON = exportToJSON;
exports.exportToJSONLines = exportToJSONLines;
exports.exportToTSV = exportToTSV;
exports.exportToHTML = exportToHTML;
exports.exportToMarkdown = exportToMarkdown;
exports.exportData = exportData;
/**
 * Convert bet records to CSV format
 */
function exportToCSV(bets) {
    if (bets.length === 0) {
        return "";
    }
    // Get all unique keys from all objects
    const keys = Array.from(new Set(bets.flatMap((bet) => Object.keys(bet))));
    // Create header row
    const header = keys.join(",");
    // Create data rows
    const rows = bets.map((bet) => {
        return keys
            .map((key) => {
            const value = bet[key];
            // Handle different value types
            if (value === null || value === undefined) {
                return "";
            }
            // Escape values containing commas, quotes, or newlines
            const stringValue = String(value);
            if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        })
            .join(",");
    });
    return [header, ...rows].join("\n");
}
/**
 * Convert bet records to JSON format (pretty printed)
 */
function exportToJSON(bets) {
    return JSON.stringify(bets, null, 2);
}
/**
 * Convert bet records to JSON Lines format (one JSON object per line)
 */
function exportToJSONLines(bets) {
    return bets.map((bet) => JSON.stringify(bet)).join("\n");
}
/**
 * Convert bet records to TSV (Tab-Separated Values) format
 */
function exportToTSV(bets) {
    if (bets.length === 0) {
        return "";
    }
    const keys = Array.from(new Set(bets.flatMap((bet) => Object.keys(bet))));
    const header = keys.join("\t");
    const rows = bets.map((bet) => {
        return keys
            .map((key) => {
            const value = bet[key];
            if (value === null || value === undefined) {
                return "";
            }
            // For TSV, replace tabs with spaces
            return String(value).replace(/\t/g, " ");
        })
            .join("\t");
    });
    return [header, ...rows].join("\n");
}
/**
 * Convert bet records to HTML table
 */
function exportToHTML(bets) {
    if (bets.length === 0) {
        return "<table><tr><td>No data</td></tr></table>";
    }
    const keys = Array.from(new Set(bets.flatMap((bet) => Object.keys(bet))));
    const header = `<thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead>`;
    const rows = bets
        .map((bet) => {
        const cells = keys
            .map((key) => {
            const value = bet[key];
            return `<td>${escapeHtml(String(value ?? ""))}</td>`;
        })
            .join("");
        return `<tr>${cells}</tr>`;
    })
        .join("");
    return `<table>${header}<tbody>${rows}</tbody></table>`;
}
/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
}
/**
 * Export bet records to markdown table format
 */
function exportToMarkdown(bets) {
    if (bets.length === 0) {
        return "No data available";
    }
    const keys = Array.from(new Set(bets.flatMap((bet) => Object.keys(bet))));
    // Header
    const header = `| ${keys.join(" | ")} |`;
    const separator = `| ${keys.map(() => "---").join(" | ")} |`;
    // Rows
    const rows = bets
        .map((bet) => {
        const values = keys.map((key) => {
            const value = bet[key];
            // Escape backslashes first, then pipe characters
            return String(value ?? "")
                .replace(/\\/g, "\\\\")
                .replace(/\|/g, "\\|");
        });
        return `| ${values.join(" | ")} |`;
    })
        .join("\n");
    return `${header}\n${separator}\n${rows}`;
}
/**
 * Export with format selection
 */
function exportData(bets, format = "json") {
    switch (format) {
        case "csv":
            return exportToCSV(bets);
        case "json":
            return exportToJSON(bets);
        case "jsonlines":
            return exportToJSONLines(bets);
        case "tsv":
            return exportToTSV(bets);
        case "html":
            return exportToHTML(bets);
        case "markdown":
            return exportToMarkdown(bets);
        default:
            return exportToJSON(bets);
    }
}
//# sourceMappingURL=dataExporter.js.map