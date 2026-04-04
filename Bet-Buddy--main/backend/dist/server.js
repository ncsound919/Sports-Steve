"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const games_1 = __importDefault(require("./routes/games"));
const ocr_1 = __importDefault(require("./routes/ocr"));
const tools_1 = __importDefault(require("./routes/tools"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check route
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// API routes
app.get("/api", (_req, res) => {
    res.json({
        message: "Bet Buddy API is running",
        version: "2.0.0",
        features: [
            "Odds Calculator",
            "Statistics Engine",
            "Data Validator",
            "Data Exporter",
            "Screenshot OCR",
            "Sports Games",
            "SimVC Currency",
            "API Integrations",
        ],
    });
    res.json({ message: "Overlay Odds API is running" });
});
// Tools API routes
app.use("/api/tools", tools_1.default);
// OCR API routes
app.use("/api/ocr", ocr_1.default);
// Games and SimVC API routes
app.use("/api/games", games_1.default);
// Error handling middleware
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map