# Sports-Steve

Sports betting agent powered by FastAPI, with pluggable sportsbook brokers and scheduled bet assessment.

## Project Structure

```
src/
├── brokers/
│   ├── __init__.py          # Package exports
│   ├── base.py              # SportsbookBroker abstract base class
│   ├── draftkings.py        # DraftKings broker (lukhed-sports)
│   └── prizepicks.py        # PrizePicks broker (httpx)
├── optimization/
│   ├── __init__.py
│   └── parlay_builder.py    # Parlay optimizer stub
├── config.py                # Application settings
├── main.py                  # FastAPI app with scheduler lifespan
└── scheduler.py             # APScheduler daily/hourly jobs
tests/
└── test_brokers.py          # Unit tests
```

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Run the API server
uvicorn src.main:app --reload

# Run tests
pytest
```

## API Endpoints

| Method | Path                    | Description                          |
|--------|-------------------------|--------------------------------------|
| POST   | `/api/v1/daily-run`     | Manually trigger daily bet assessment |
| POST   | `/api/v1/resolve-bets`  | Manually trigger bet resolution       |

## Configuration

Set via environment variables:

| Variable               | Default            | Description                     |
|------------------------|--------------------|---------------------------------|
| `ACTIVE_SPORTS`        | `NFL,NBA,NHL,MLB`  | Comma-separated sports to monitor |
| `MAX_DAILY_STAKE`      | `100.0`            | Maximum daily stake budget (USD)  |
| `MIN_EDGE`             | `0.05`             | Minimum edge threshold            |
| `PRIZEPICKS_AUTH_TOKEN` | (empty)           | PrizePicks auth token (optional)  |
| `LOG_LEVEL`            | `INFO`             | Logging level                     |
