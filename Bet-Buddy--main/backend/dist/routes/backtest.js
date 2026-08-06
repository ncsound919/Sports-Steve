"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Backtest routes — test betting theories against the deterministic-brain
// historical NBA datasets (CSV). Reuses Bet Buddy's statistics engine for the
// P&L / ROI / Kelly math.
const express_1 = require("express");
const fs_1 = require("fs");
const path_1 = require("path");
const statisticsEngine_1 = require("../utils/statisticsEngine");
const router = (0, express_1.Router)();
const DATASETS_DIR = process.env.SPORTS_DATASETS_DIR ||
    path_1.join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..", "integrations", "deterministic-brain", "datasets");
function resolveDatasetsDir() {
    // Walk up looking for integrations/deterministic-brain/datasets
    let dir = path_1.resolve(__dirname);
    while (dir && dir.length > 3) {
        const candidate = path_1.join(dir, "integrations", "deterministic-brain", "datasets");
        if (fs_1.existsSync(candidate)) {
            return candidate;
        }
        dir = path_1.dirname(dir);
    }
    return DATASETS_DIR;
}
const realDatasetsDir = resolveDatasetsDir();
function readCsv(file) {
    const text = fs_1.readFileSync(path_1.join(realDatasetsDir, file), "utf-8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
        return [];
    }
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
        const cols = line.split(",");
        const row = {};
        header.forEach((h, i) => (row[h] = (cols[i] || "").trim()));
        return row;
    });
}
function f(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function usToDecimal(us) {
    if (us > 0) {
        return 1 + us / 100;
    }
    if (us < 0) {
        return 1 + 100 / Math.abs(us);
    }
    return 1;
}
function buildGamesIndex() {
    const index = {};
    for (const row of readCsv("nba_games_all.csv")) {
        const gid = row["game_id"];
        if (!gid) {
            continue;
        }
        const isHome = (row["is_home"] || "").toLowerCase() === "t";
        const pts = f(row["pts"]);
        const entry = index[gid] || (index[gid] = {
            home_team: null, away_team: null,
            home_pts: null, away_pts: null, date: row["game_date"] || "",
            matchup: row["matchup"] || "",
        });
        if (isHome) {
            entry.home_team = row["team_id"];
            entry.home_pts = pts;
        }
        else {
            entry.away_team = row["team_id"];
            entry.away_pts = pts;
        }
    }
    return index;
}
function settleSpread(game, teamId, spread) {
    if (!game || game.home_pts === null || game.away_pts === null) {
        return "unsettled";
    }
    const teamPts = game.home_team === teamId ? game.home_pts : game.away_pts;
    const oppPts = game.home_team === teamId ? game.away_pts : game.home_pts;
    const margin = teamPts + spread - oppPts;
    if (Math.abs(margin) < 0.01) {
        return "push";
    }
    return margin > 0 ? "win" : "loss";
}
function settleTotal(game, total, pick) {
    if (!game || game.home_pts === null || game.away_pts === null) {
        return "unsettled";
    }
    const margin = game.home_pts + game.away_pts - total;
    if (Math.abs(margin) < 0.01) {
        return "push";
    }
    if (pick === "over") {
        return margin > 0 ? "win" : "loss";
    }
    return margin < 0 ? "win" : "loss";
}
function runStrategy(strategy, dateFrom, dateTo, stake, maxBets) {
    const index = buildGamesIndex();
    const bets = [];
    if (strategy === "totals_over" || strategy === "totals_under") {
        const pick = strategy.replace("totals_", "");
        for (const row of readCsv("nba_betting_totals.csv")) {
            const game = index[row["game_id"]];
            const total = f(row["total1"]);
            const price = f(row["price1"]);
            if (!game || total === null || price === null) {
                continue;
            }
            if (dateFrom && game.date < dateFrom) {
                continue;
            }
            if (dateTo && game.date > dateTo) {
                continue;
            }
            const outcome = settleTotal(game, total, pick);
            if (outcome === "unsettled") {
                continue;
            }
            bets.push({
                gameId: row["game_id"], date: game.date, matchup: game.matchup,
                selection: pick, line: total, odds: usToDecimal(price), stake,
                outcome, won: outcome === "win",
            });
            if (bets.length >= maxBets) {
                break;
            }
        }
    }
    else if (strategy.startsWith("spread_")) {
        for (const row of readCsv("nba_betting_spread.csv")) {
            const game = index[row["game_id"]];
            const spread = f(row["spread1"]);
            const price = f(row["price1"]);
            if (!game || spread === null || price === null) {
                continue;
            }
            if (dateFrom && game.date < dateFrom) {
                continue;
            }
            if (dateTo && game.date > dateTo) {
                continue;
            }
            let pickTeam = row["team_id"];
            let pickSpread = spread;
            let pickPrice = price;
            if (strategy === "spread_favorite" && spread >= 0) {
                continue;
            }
            if (strategy === "spread_underdog" && spread <= 0) {
                continue;
            }
            if (strategy === "spread_home") {
                if (game.home_team === row["team_id"]) {
                    pickTeam = row["team_id"];
                    pickSpread = spread;
                    pickPrice = price;
                }
                else if (game.home_team === row["a_team_id"]) {
                    pickTeam = row["a_team_id"];
                    pickSpread = -spread;
                    pickPrice = f(row["price2"]) || price;
                }
                else {
                    continue;
                }
            }
            const outcome = settleSpread(game, pickTeam, pickSpread);
            if (outcome === "unsettled") {
                continue;
            }
            bets.push({
                gameId: row["game_id"], date: game.date, matchup: game.matchup,
                selection: pickTeam, line: pickSpread, odds: usToDecimal(pickPrice), stake,
                outcome, won: outcome === "win",
            });
            if (bets.length >= maxBets) {
                break;
            }
        }
    }
    else {
        throw new Error(`unknown strategy: ${strategy}`);
    }
    const decided = bets.filter((b) => b.outcome !== "push");
    const stats = statisticsEngine_1.calculateStatistics(decided);
    const profit = decided.reduce((s, b) => s + (b.won ? b.stake * b.odds - b.stake : -b.stake), 0);
    const totalStaked = decided.reduce((s, b) => s + b.stake, 0);
    return {
        strategy,
        betsPlaced: bets.length,
        decided: decided.length,
        wins: decided.filter((b) => b.won).length,
        losses: decided.filter((b) => !b.won).length,
        pushes: bets.length - decided.length,
        stats,
        profit: Math.round(profit * 100) / 100,
        roiPct: totalStaked ? Math.round((profit / totalStaked) * 10000) / 100 : 0,
        sampleBets: decided.slice(0, 5),
    };
}
router.get("/datasets", (_req, res) => {
    const files = ["nba_games_all.csv", "nba_betting_totals.csv", "nba_betting_spread.csv"];
    res.json({ datasetsDir: realDatasetsDir, files });
});
router.get("/strategies", (_req, res) => {
    res.json({ strategies: ["spread_favorite", "spread_home", "spread_underdog", "totals_over", "totals_under"] });
});
router.post("/run", (req, res) => {
    try {
        const { strategy, date_from = "", date_to = "", stake = 10, max_bets = 3000 } = req.body || {};
        const result = runStrategy(strategy, date_from, date_to, Number(stake), Number(max_bets));
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
exports.default = router;
