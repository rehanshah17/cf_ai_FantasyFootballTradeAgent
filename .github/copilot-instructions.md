
You are assisting on a Cloudflare Workers project that evaluates fantasy trades and produces persona-based writeups. Use Cloudflare’s stack: Workers, Durable Objects, Workers AI, and Vectorize. Favor small, composable functions, TypeScript types, and pure logic modules that don’t touch Env directly.

## Project Summary
- **Goal:** Evaluate a proposed trade between two fantasy teams; compute value deltas; flag risk; retrieve similar trades; generate a persona writeup.
- **Stack:** Cloudflare Workers (TypeScript), Durable Objects (league state), Workers AI (Llama 3.3 + embeddings), Vectorize (trade comps), Pages (simple UI).
- **Scope (MVP/NFL):** One league, two teams, ~15–20 players, PPR scoring, baselines per position (QB/RB/WR/TE), simple trade grade (A–F).

## Key Files
- `worker/src/index.ts` — Worker entry. Export `default` (fetch handler). **Re-export** the Durable Object class:  
  `export { LeagueState } from "./durable/LeagueState";`
- `worker/src/durable/LeagueState.ts` — DO that stores `League` JSON and appends trade history.
- `worker/src/agent/TradeAgent.ts` — `evaluateTrade(env, league, proposal, persona)`.
- `worker/src/services/value.ts` — value math (POV/z-score).
- `worker/src/services/risk.ts` — injury/volatility flags.
- `worker/src/services/comps.ts` — Vectorize insert/query helpers.
- `worker/src/llm/writeup.ts` — Persona writeups via Workers AI.
- `worker/src/types.ts` — `League`, `Team`, `Player`, `TradeProposal`, `TradeEvaluation`.
- `pages/index.html`, `pages/app.js` — Minimal UI to init a league and evaluate trades.

## Data Shapes (authoritative)
```ts
type Player = { id: string; name: string; team: string; pos: string[]; proj: number; injury?: { status: "OK"|"DTD"|"O"; note?: string } };
type Team = { id: string; name: string; needs: string[]; roster: string[] };
type League = { leagueId: string; teams: Team[]; players: Player[]; rules: Record<string, unknown>; history: TradeRecord[] };
type TradeProposal = { leagueId: string; fromTeamId: string; toTeamId: string; give: string[]; get: string[] };
type TradeEvaluation = { grade: "A"|"B"|"C"|"D"|"F"; deltaValueFrom: number; deltaValueTo: number; risks: string[]; comps: string[]; personaWriteup: string };