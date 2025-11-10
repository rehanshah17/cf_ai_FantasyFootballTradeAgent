# Prompts.md

## Frontend Styling & UI Prompts

### Retro Bowl UI and Controls
Prompt: “Re-theme the frontend to feel like Retro Bowl. Use pixel fonts, a scoreboard banner, turf background, and chips for sections. Replace text inputs with a persona dropdown (Analytics Bot, SchefterBot, Stephen A. Smith), and keep league/trade inputs as textareas. Make sure the JS wiring still works.”

### Frontend Readability and Streaming
Prompt: “When a trade is queued, immediately show ‘Evaluating trade…’ and stream the result via SSE. If the stream fails, fall back to polling. Render the evaluation as a card (grade, deltas, persona writeup) instead of raw JSON. Also format the GM Memory panel with readable sentences rather than displaying JSON.stringify.”

## Backend & Workflow Prompts

### SSE Architecture
Prompt: “Explain how to build an event-driven streaming pipeline with Cloudflare Durable Objects + Workflows. I need an SSE endpoint (/api/stream?id=...), a StreamHub DO that buffers or forwards events, and the EvaluateTradeWorkflow should POST completion events to the hub. Provide code snippets for the DO and Worker routes.”

### Vector Embedding Reliability
Prompt: “similarTrades() is throwing ‘Embedding error: expected 768 dims, got 0’. Show how to harden the embedding call: guard empty text, log previews, call @cf/baai/bge-small-en-v1.5 correctly, and return [] if the vector is invalid so the workflow keeps running.”

### Workflow Queuing & Status
Prompt: “Modify /api/trade/evaluate to queue a workflow with env.EVALUATE_TRADE.create({ id, params }). Return { id, status: 'queued' } only. Add /api/trade/status and /api/stream to allow the frontend to poll or stream until the workflow emits its final evaluation.”

## Repo Structure & Config Prompts

### Monorepo Split
Prompt: “Deploys are failing because Pages and Workers share wrangler.toml. Split the repo: `worker/` for the API (with its own wrangler.toml and migrations) and `frontend/` for Pages (with its wrangler config). Update imports so the Worker no longer reads frontend files. Document the new layout in README.”

### README Accuracy
Prompt: “Review README to ensure it matches the current stack: Workers + Workflows + Durable Objects + SSE + Vectorize. Add deploy steps, persona descriptions, and notes about running `wrangler types` after binding changes.”

## Debugging & Questions Logged

- How do we structure SSE keep-alive heartbeats inside a Durable Object so the Worker can pipe responses to the browser?
- What is the correct payload shape for @cf/baai/bge-small-en-v1.5 (array vs string, pooling setting) so Vectorize always receives a 768-dim vector?
- How should the workflow emit results back to StreamHub, and how do we guarantee the frontend receives exactly one final event?