# Sports Steve

AI-powered sports betting intelligence agent with pluggable sportsbook brokers, automated scheduling, and a unified React frontend. Includes **Bet Buddy** as a companion sub-project for manual betting tools.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Standalone Mode](#standalone-mode)
- [Draymond Orchestrator Ready](#draymond-orchestrator-ready)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Overview

**Sports Steve** is an AI-driven sports betting analysis and execution engine. It fetches live odds from multiple sportsbooks, applies statistical modeling (Kelly criterion, circadian fatigue adjustments, correlation analysis), and manages risk with stop-loss enforcement, exposure monitoring, and budget controls. A built-in APScheduler runs daily bet assessments and hourly bet resolution automatically.

**Bet Buddy** is a companion toolkit bundled as a sub-project. It provides hands-on betting utilities — odds calculators, OCR screenshot extraction, bankroll management tools, and SimVC (simulated venture capital) games — all served via a Node.js/Express backend.

Both are surfaced through a **unified React frontend** that supports two modes:

- **Beginner Mode** — simplified views, explanatory tooltips, guided workflows for new bettors
- **Expert Mode** — full statistical dashboards, Kelly criterion details, CLV (closing line value) tracking, and raw data tables

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Unified Frontend                            │
│              React 19 + Vite 6 + TailwindCSS 3                  │
│           Glassmorphic UI  ·  Beginner/Expert modes              │
│                    http://localhost:5173                         │
└────────────────┬──────────────────────┬─────────────────────────┘
                 │                      │
                 ▼                      ▼
┌─────────────────────────┐  ┌─────────────────────────────────┐
│   Sports Steve Backend  │  │      Bet Buddy Backend          │
│   Python / FastAPI      │  │      Node.js / Express 5        │
│   http://localhost:8010 │  │      http://localhost:3001      │
│                         │  │                                 │
│  • APScheduler cron     │  │  • Odds calculator              │
│  • Pluggable brokers    │  │  • OCR screenshot extraction    │
│  • Risk manager         │  │  • Bankroll tools               │
│  • Kelly criterion      │  │  • Kelly criterion              │
│  • Budget manager       │  │  • Statistics engine            │
│  • Circadian factoring  │  │  • SimVC games                  │
│  • Account tracker      │  │  • 30+ API endpoints            │
│  • Parlay optimizer     │  │                                 │
└─────────┬───────────────┘  └─────────────────────────────────┘
          │
          ▼
┌─────────────────────────┐
│    Sportsbook Brokers   │
│  DraftKings (lukhed)    │
│  PrizePicks (httpx)     │
│  + extend via base.py   │
└─────────────────────────┘
```

---

## Features

### Core Betting Engine

- **Pluggable sportsbook brokers** — DraftKings (via `lukhed-sports`) and PrizePicks (via `httpx`). Add new brokers by implementing `SportsbookBroker` in `src/brokers/base.py`.
- **Kelly criterion stake sizing** — fractional Kelly with configurable fraction (default 0.25) and max exposure cap.
- **Parlay optimization** — exhaustive combination of candidate legs, filtered by minimum edge, ranked by expected value. Supports circadian-adjusted EV.
- **Correlation analysis** — parlay builder evaluates leg independence for more accurate win probability estimates.

### Risk Management

- **Stop-loss enforcement** — automatic cool-down triggered when daily loss exceeds configurable percentage of bankroll.
- **Exposure monitoring** — real-time tracking of open stake by broker and sport, with percentage-of-bankroll caps.
- **Cool-down triggers** — prevents new bet placement until the next trading day when stop-loss fires.
- **Monte Carlo ruin gates** — configurable max ruin probability and simulation count before allowing bet placement.

### Circadian Fatigue Adjustments

- Late-night game penalties (5% edge reduction for games after 9 PM local)
- Back-to-back schedule penalties (8% for away, 4% for home)
- Cross-country timezone shift penalties (4% per hour eastward, capped at 20%)
- Optimal performance window bonuses (2% for 2-8 PM tip-off)
- Sport-specific sensitivity (NBA, NHL, NFL, NCAAMB)

### Budget Management

- **Daily / weekly / monthly spend limits** — configurable via environment variables or runtime API.
- **Per-sport sub-limits** — optional granular budgets per sport.
- **Gating** — budget manager blocks bet placement when any limit would be breached.
- **Reporting** — utilization percentages, remaining budget, and period breakdowns.

### Multi-Sportsbook Account Tracking

- Register and monitor balances across DraftKings, PrizePicks, FanDuel, and any other book.
- Track deposits, withdrawals, and bet outcomes per account.
- Health monitoring — flags limited, gubbed, or low-balance accounts.
- Aggregate total funds across all sportsbooks.

### Audit Trail

- Every bet is recorded with broker ID, sport, legs, stake, odds, expected value, and timestamps.
- Full settlement history with win/loss/void tracking and P&L updates.
- In-memory audit log (swap in DB persistence for production).

### Automated Scheduling

| Job                    | Schedule         | Description                                    |
|------------------------|------------------|------------------------------------------------|
| `reset_daily_limits`   | Daily at 00:00   | Resets stop-loss, cool-down, and daily P&L     |
| `daily_bet_assessment` | Daily at 09:00   | Generates parlays, validates edge, places bets |
| `resolve_bets`         | Hourly at :05    | Checks pending bets and settles results        |

### Bet Buddy Companion Tools

- **Odds Calculator** — convert between American, decimal, and fractional odds.
- **OCR Screenshot Extraction** — upload a sportsbook screenshot, extract bet slip data via Tesseract.js.
- **Bankroll Management** — unit sizing, session tracking, deposit/withdrawal logging.
- **Kelly Criterion Calculator** — interactive Kelly stake calculator with fractional Kelly support.
- **Statistics Engine** — win rate, ROI, CLV, and streak analysis.
- **SimVC Games** — simulated venture capital betting games for practice.

### Frontend

- **Glassmorphic UI** — dark theme with backdrop blur, glass cards, and glow animations.
- **Red / black / green color scheme** — loss red (`#FF1744`), surface black, win green (`#00E676`).
- **Beginner mode** — explanations, tooltips, simplified views for new bettors.
- **Expert mode** — full stats tables, Kelly criterion details, CLV tracking, raw data.
- **Help Center** — glossary of betting terms, technique guides, and API setup instructions.
- **Pages**: Dashboard, Odds Calculator, Bankroll Manager, Bet History, Help Center, Settings.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn

### 1. Backend (Sports Steve)

```bash
# From project root
pip install -e ".[dev]"

# Start the FastAPI server
uvicorn src.main:app --port 8010 --reload
```

The API will be available at `http://localhost:8010`. The APScheduler starts automatically with the server lifespan.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI will be available at `http://localhost:5173`.

### 3. Bet Buddy Backend (optional)

```bash
cd Bet-Buddy--main/backend
npm install
npm start
```

Bet Buddy runs at `http://localhost:3001`.

### 4. Run Tests

```bash
# From project root
pytest
```

---

## Standalone Mode

Sports Steve is a fully self-contained application. **No external orchestrator is required.**

To run standalone:

1. Start the backend: `uvicorn src.main:app --port 8010 --reload`
2. Start the frontend: `cd frontend && npm run dev`
3. (Optional) Start Bet Buddy: `cd Bet-Buddy--main/backend && npm start`

The APScheduler handles all automated workflows internally — daily bet assessment at 9 AM, hourly bet resolution, and daily limit resets at midnight. The frontend connects directly to both backends.

---

## Draymond Orchestrator Ready

> **Sports Steve is a registered entity in the Draymond Orchestrator ecosystem.**

### What is Draymond?

[Draymond](../../../Draymond-Orchestrator-main) is the central AI agent management dashboard for the **Uplift Ecosystem**. It provides:

- A unified registry of all agents, tools, skills, and services
- Multi-agent workflow orchestration via **chain templates**
- Scheduled job execution with health monitoring
- Confidence gating, tiered memory, and audit trails
- A visual dashboard for monitoring agent health and triggering workflows

### How Sports Steve Connects

Sports Steve is registered in Draymond's entity registry (`seed.ts`) and business chain system (`business-chains.ts`) with the following configuration:

| Property             | Value                                          |
|----------------------|------------------------------------------------|
| **Name**             | Sports Steve                                   |
| **Slug**             | `sports-steve`                                 |
| **Kind**             | `agent`                                        |
| **Invocation**       | `http_api` (REST API)                          |
| **Base URL**         | `http://localhost:8010` (configurable via env)  |
| **Health Endpoint**  | `/health`                                      |
| **Category**         | `sports`                                       |
| **Capabilities**     | `daily_bet_assessment`, `bet_resolution`, `odds_analysis`, `kelly_criterion` |

Bet Buddy is also registered as a companion service:

| Property             | Value                                          |
|----------------------|------------------------------------------------|
| **Name**             | Bet Buddy                                      |
| **Slug**             | `bet-buddy`                                    |
| **Kind**             | `service`                                      |
| **Invocation**       | `http_api` (REST API)                          |
| **Base URL**         | `http://localhost:3001` (configurable via env)  |
| **Capabilities**     | `odds_calculation`, `kelly_criterion`, `bankroll_management`, `screenshot_ocr`, `sports_statistics` |

### Draymond Workflow: Sports Betting Daily Chain

When connected to Draymond, Sports Steve participates in the **"Sports Betting Daily"** chain template — a multi-step automated pipeline:

```
Step 1: Daily Assessment
  └─ sports-steve → POST /api/v1/daily-run
       ↓
Step 2: Odds Calculation
  └─ bet-buddy → POST /api/odds
       ↓
Step 3: Kelly Sizing
  └─ bet-buddy → POST /api/kelly
```

This chain is scheduled to run daily at 12:00 PM via Draymond's cron system.

### What Draymond Integration Enables

When connected to Draymond, Sports Steve can be:

- **Monitored** from the central dashboard — health checks every 15 minutes, status tracking, and failure alerts.
- **Triggered** as part of multi-agent workflows (chains) — e.g., the "Morning Briefing" chain combines Sports Steve picks with finance signals and supply chain alerts into a daily digest.
- **Managed** alongside other agents in the Uplift Ecosystem — Uplift Agent, Sub Team, OmniResearch Pro, Social Media Dashboard, TradingAgents, MegaCode, and more.
- **Scheduled** via Draymond's cron system — override or supplement the built-in APScheduler jobs.

### Connection is Optional

Draymond integration is entirely optional. Sports Steve does not import, depend on, or require any Draymond packages. The connection is established externally by Draymond calling Sports Steve's REST API endpoints. If Draymond is not running, Sports Steve operates independently with its own APScheduler-based automation.

---

## Environment Variables

Create a `.env` file in the project root. All variables have sensible defaults.

### API Keys

| Variable                   | Default | Description                                      |
|----------------------------|---------|--------------------------------------------------|
| `THE_ODDS_API_KEY`         | (empty) | API key for The Odds API (cross-book odds comparison) |
| `THE_RUNDOWN_API_KEY`      | (empty) | API key for The Rundown (alternative odds source) |
| `PRIZEPICKS_SESSION_COOKIE`| (empty) | PrizePicks session cookie (auto-extracted via CDP) |
| `PRIZEPICKS_CSRF_TOKEN`    | (empty) | PrizePicks CSRF token for authenticated requests |

### Risk Management

| Variable                  | Default  | Description                                           |
|---------------------------|----------|-------------------------------------------------------|
| `RISK_BANKROLL`           | `1000.0` | Current bankroll balance (USD) — update after sessions |
| `RISK_MAX_DAILY_LOSS_PCT` | `0.10`   | Max daily loss as fraction of bankroll (triggers stop-loss) |
| `RISK_MAX_EXPOSURE_PCT`   | `0.20`   | Max open exposure as fraction of bankroll              |
| `RISK_KELLY_FRACTION`     | `0.25`   | Fractional Kelly multiplier (0.25 = quarter Kelly)    |
| `MAX_BETS_PER_DAY`        | `2`      | Maximum bets placed per day                           |
| `MAX_DAILY_STAKE`         | `100.0`  | Maximum total daily stake (USD)                       |
| `MIN_BET_AMOUNT`          | `5.0`    | Minimum allowed Kelly-sized bet in USD                |

### Edge / Quality Gates

| Variable                | Default | Description                                        |
|-------------------------|---------|----------------------------------------------------|
| `MIN_EDGE`              | `0.05`  | Minimum edge threshold to place a bet (5%)         |
| `MIN_EDGE_RATIO`        | `1.05`  | Minimum edge ratio for bet qualification           |
| `MIN_WIN_PROBABILITY`   | `0.57`  | Minimum estimated win probability                  |
| `MIN_CONSENSUS_BOOKS`   | `2`     | Minimum sportsbooks agreeing on the line           |
| `MIN_PLAYER_CONFIDENCE` | `0.70`  | Minimum player confidence score for prop bets      |

### Monte Carlo Simulation

| Variable                    | Default | Description                               |
|-----------------------------|---------|-------------------------------------------|
| `MONTE_CARLO_MAX_RUIN_PCT`  | `0.10`  | Max acceptable ruin probability (10%)     |
| `MONTE_CARLO_N_SIMS`        | `5000`  | Number of Monte Carlo simulations to run  |

### Budget Limits

| Variable              | Default | Description                                   |
|-----------------------|---------|-----------------------------------------------|
| `BUDGET_DAILY_LIMIT`  | `0.0`   | Daily spend limit in USD (0 = disabled)       |
| `BUDGET_WEEKLY_LIMIT` | `0.0`   | Weekly spend limit in USD (0 = disabled)      |
| `BUDGET_MONTHLY_LIMIT`| `0.0`   | Monthly spend limit in USD (0 = disabled)     |

### Sports & Scheduling

| Variable        | Default           | Description                        |
|-----------------|-------------------|------------------------------------|
| `ACTIVE_SPORTS` | `NFL,NBA,NHL,MLB` | Comma-separated sports to monitor  |

### System

| Variable               | Default                              | Description                                 |
|------------------------|--------------------------------------|---------------------------------------------|
| `ENV`                  | `development`                        | Environment mode for auth and CORS defaults |
| `LOG_LEVEL`            | `INFO`                               | Logging level                               |
| `SPORTS_STEVE_API_KEY` | _unset_                              | Required outside development for API access |
| `CORS_ORIGINS`         | `http://localhost:5173` (development) | Comma-separated allowed frontend origins    |

---

## API Endpoints

### Sports Steve (`:8010`)

| Method | Path                   | Description                           |
|--------|------------------------|---------------------------------------|
| POST   | `/api/v1/daily-run`    | Manually trigger daily bet assessment |
| POST   | `/api/v1/resolve-bets` | Manually trigger bet resolution       |

### Bet Buddy (`:3001`)

| Method | Path            | Description                        |
|--------|-----------------|------------------------------------|
| GET    | `/health`       | Health check                       |
| POST   | `/api/odds`     | Odds conversion and calculation    |
| POST   | `/api/kelly`    | Kelly criterion stake sizing       |
| POST   | `/api/bankroll` | Bankroll management operations     |
| POST   | `/api/ocr`      | Screenshot OCR extraction          |
| GET    | `/api/stats`    | Betting statistics and analytics   |

---

## Project Structure

```
Sports-Steve-main/
├── src/                              # Sports Steve backend (Python)
│   ├── brokers/
│   │   ├── __init__.py               # Package exports
│   │   ├── base.py                   # SportsbookBroker abstract base class
│   │   ├── draftkings.py             # DraftKings broker (lukhed-sports)
│   │   └── prizepicks.py             # PrizePicks broker (httpx)
│   ├── optimization/
│   │   ├── __init__.py
│   │   └── parlay_builder.py         # Parlay builder + optimizer (EV, Kelly, circadian)
│   ├── __init__.py
│   ├── account_tracker.py            # Multi-sportsbook account tracking
│   ├── budget.py                     # Budget management (daily/weekly/monthly)
│   ├── circadian.py                  # Circadian fatigue adjustments
│   ├── config.py                     # Application settings (env-driven)
│   ├── main.py                       # FastAPI app with scheduler lifespan
│   ├── risk_manager.py               # Risk management (Kelly, stop-loss, exposure, audit)
│   └── scheduler.py                  # APScheduler daily/hourly jobs
│
├── frontend/                         # Unified React frontend
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts             # API client for backend communication
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx      # Main layout wrapper
│   │   │   │   └── Sidebar.tsx        # Navigation sidebar
│   │   │   └── ui/
│   │   │       ├── GlassCard.tsx      # Glassmorphic card component
│   │   │       └── ModeToggle.tsx     # Beginner/Expert mode toggle
│   │   ├── contexts/
│   │   │   └── ModeContext.tsx        # Beginner/Expert mode state
│   │   ├── data/
│   │   │   └── glossary.ts           # Betting terms glossary
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx          # Main dashboard
│   │   │   ├── OddsCalculator.tsx     # Odds conversion tool
│   │   │   ├── BankrollManager.tsx    # Bankroll management
│   │   │   ├── BetHistory.tsx         # Bet history and audit trail
│   │   │   ├── HelpCenter.tsx         # Glossary, techniques, API guides
│   │   │   └── Settings.tsx           # App settings
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript type definitions
│   │   ├── App.tsx                    # Route definitions
│   │   ├── main.tsx                   # React entry point
│   │   └── index.css                  # Global styles + Tailwind
│   ├── package.json
│   ├── tailwind.config.js             # Custom theme (glassmorphic colors)
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── Bet-Buddy--main/                   # Bet Buddy sub-project
│   ├── backend/                       # Node.js/Express API server
│   └── frontend/                      # Bet Buddy standalone frontend (legacy)
│
├── tests/
│   ├── __init__.py
│   ├── test_brokers.py                # Broker unit tests
│   └── test_features.py               # Feature integration tests
│
├── .env                               # Environment configuration
├── .gitignore
├── pyproject.toml                     # Python project config (pip install -e .)
├── requirements.txt                   # Python dependencies (alternative)
└── README.md                          # This file
```

---

## Tech Stack

### Sports Steve Backend

| Technology   | Version | Purpose                                    |
|-------------|---------|--------------------------------------------|
| Python       | 3.11+   | Runtime                                    |
| FastAPI      | 0.110+  | REST API framework                         |
| APScheduler  | 3.10+   | Cron-based job scheduling                  |
| httpx        | 0.27+   | Async HTTP client (PrizePicks broker)      |
| lukhed-sports| 0.6+    | DraftKings odds data (optional dependency) |
| pytest       | 8.0+    | Testing framework                         |

### Bet Buddy Backend

| Technology    | Version | Purpose                          |
|--------------|---------|----------------------------------|
| Node.js       | 18+     | Runtime                          |
| Express        | 5       | REST API framework               |
| Tesseract.js  | latest  | OCR for screenshot extraction    |

### Unified Frontend

| Technology     | Version | Purpose                              |
|---------------|---------|--------------------------------------|
| React          | 19      | UI framework                         |
| Vite           | 6       | Build tool and dev server            |
| TypeScript     | 5.7+    | Type safety                          |
| TailwindCSS    | 3.4+    | Utility-first CSS (glassmorphic theme) |
| React Router   | 7.1+    | Client-side routing                  |
| Lucide React   | 0.460+  | Icon library                         |

---

## License

MIT
