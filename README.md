# Cloudflare Fantasy Trade GM Agent

This project is an AI-powered fantasy football trade evaluator built on the Cloudflare Developer Platform. It combines Workers, Workflows, Durable Objects, Vectorize, and Workers AI to assess trades between fantasy teams in real time.

## Overview

The system allows users to:
- Initialize a fantasy league with teams, players, and rules.
- Submit a trade proposal between two teams.
- Automatically evaluate the trade using AI personas.
- Stream live evaluation updates directly to the browser.
- Persist trade history and league data using Durable Objects.

## Tech Stack

### Cloudflare Services
- **Workers**: Hosts the API endpoints and routes.
- **Workflows**: Executes trade evaluations asynchronously.
- **Durable Objects (LeagueState)**: Persists league and trade history.
- **Durable Objects (StreamHub)**: Handles Server-Sent Event (SSE) connections for live updates.
- **Workers AI**: Generates trade reasoning and embeddings.
- **Vectorize Index**: Stores embeddings to find similar historical trades.

### Frontend
- Deployed via Cloudflare Pages
- Static HTML/JS UI (no framework build step)
- Uses Server-Sent Events (SSE) to receive workflow results in real time (falls back to polling if SSE fails)

## Project Structure

```
cloudflare/
├── worker/
│   ├── src/
│   │   ├── index.ts               # Main API router
│   │   ├── durable/
│   │   │   ├── LeagueState.ts     # League and history storage
│   │   │   └── StreamHub.ts       # SSE broadcast hub
│   │   └── workflows/
│   │       └── EvaluateTradeWorkflow.ts  # Trade evaluation logic
│   ├── worker-configuration.d.ts
│   └── wrangler.toml              # Worker configuration and bindings
└── frontend/
    ├── index.html
    ├── app.js
    ├── style.css
    └── wrangler.toml              # Pages deployment configuration
```

## API Routes

| Route | Method | Description |
|-------|---------|-------------|
| `/api/league/init` | POST | Initialize a new fantasy league |
| `/api/trade/evaluate` | POST | Queue a new trade evaluation workflow |
| `/api/trade/status` | GET | Check workflow status (fallback for SSE) |
| `/api/memory/get` | GET | Retrieve current league memory |
| `/api/stream` | GET | Connect via SSE for live trade updates |

## Development

### 1. Type check (optional but recommended)
```bash
npx tsc --noEmit
```

### 2. Deploy the Worker
```bash
cd worker
npx wrangler deploy
```

### 3. Deploy the Frontend
```bash
cd ../frontend
npx wrangler pages deploy --project-name cf-fantasy-trade-gm-agent
```

## Environment Bindings

| Binding | Type | Description |
|----------|------|-------------|
| `AI` | Workers AI | Access to Cloudflare's model APIs |
| `VECTORIZE` | Vectorize Index | Similar trade search |
| `LEAGUE_STATE` | Durable Object | Stores leagues and trade histories |
| `STREAM_HUB` | Durable Object | Manages live SSE connections |
| `EVALUATE_TRADE` | Workflow | Asynchronous trade evaluation |

## Personas
The frontend exposes a dropdown with preset personas. The Worker chooses the corresponding prompt when calling Workers AI:
- **Analytics Bot** – robotic, projection-driven summary with variance commentary.
- **SchefterBot** – breaking-news tone (“Per sources…”).
- **Stephen A. Smith** – emotional TV rant that opens with “This is egregious! Outrageous!” and similar flourishes.

You can extend `PERSONA_STYLES` in `worker/src/llm/writeup.ts` to add more voices.

## Example Usage

1. Initialize a demo league:
   ```json
   {
     "leagueId": "demo-nfl",
     "teams": [
       { "id": "A", "name": "Team A", "needs": ["WR_depth"], "roster": ["p1", "p2"] },
       { "id": "B", "name": "Team B", "needs": ["RB_depth"], "roster": ["p3", "p4"] }
     ],
     "players": [
       { "id": "p1", "name": "Tyreek Hill", "team": "MIA", "pos": ["WR"], "proj": 20.4 },
       { "id": "p3", "name": "Christian McCaffrey", "team": "SF", "pos": ["RB"], "proj": 21.5 }
     ],
     "rules": { "format": "PPR" },
     "history": []
   }
   ```

2. Submit a trade:
   ```json
   {
     "leagueId": "demo-nfl",
     "fromTeamId": "A",
     "toTeamId": "B",
     "give": ["p1"],
     "get": ["p3"]
   }
   ```

3. Watch the result stream live on the frontend.

## Notes & Tips
- Run `cd worker && npx wrangler types` whenever you change `worker/wrangler.toml` so the generated runtime types stay in sync.
- The frontend’s `API_BASE` constant defaults to the production Worker URL. Change it to `http://localhost:8787` when developing locally.
- SSE streams originate from the `StreamHub` Durable Object. If you change bindings, update the migrations in `worker/wrangler.toml` accordingly.