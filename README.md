# Fantasy Trade GM Agent (Cloudflare Workers + Durable Objects + Vectorize + Workers AI)


An AI agent that evaluates fantasy trades, tracks negotiation context, and role‑plays distinct GM personas. Built to showcase Cloudflare's AI + stateful platform.


## Cloudflare stack
- **Workers AI**: Llama 3.3 for structured reasoning + persona write‑ups
- **Durable Objects**: per‑league state (rosters, rules, negotiation history)
- **Vectorize**: semantic memory of past trades for “similar comps”
- **Workers**: agent logic + HTTP API
- **Pages**: minimal chat/upload UI


## Quickstart


1. **Install deps**


```bash
npm i
```


2. **Configure wrangler auth**


```bash
npx wrangler login
```


3. **Create Vectorize index (one‑time)**


```bash
npx wrangler vectorize create trades-index --preset text-embedding-3-small
```
> Or adjust the preset to your preferred embedding model.


4. **Dev**


```bash
npx wrangler dev --local worker/src/index.ts
```


5. **Deploy**


```bash
npx wrangler deploy
```


6. **Open Pages preview** (serves `/pages` via static assets in this repo or use your own Pages project). For simple local testing, open `pages/index.html` in a static server and point it at your Worker route.


## Upload format (MVP)
- `roster.json`: `{ teams: Team[], players: Player[] }`
- `rules.json`: scoring, roster slots, keeper flags


See `/worker/src/types.ts` for example interfaces.


## Endpoints
- `POST /api/league/init` – initialize a league (stores rosters/rules in Durable Object)
- `POST /api/trade/evaluate` – evaluate a proposed trade (runs pipeline, returns grade + write‑up)
- `POST /api/trade/counter` – generate counter offer using Vectorize comps + needs
- `GET /api/league/state` – debug view of league state


## Personas
- Default, **Morey**, **Ujiri**, **Presti** → change tone and risk appetite in LLM prompts.


## Notes
- This scaffold keeps the “workflow” orchestration in code for simplicity. You can later extract to **Cloudflare Workflows** once your steps are stable.
```
