# Prompts.md


### Request Handling Prompt
> - Add CORS headers dynamically using `withCors()` helper.  
> - Wrap all route handlers in `try/catch` with JSON-encoded error responses.

### Workflow Trigger Prompt
> Codex, change the `/api/trade/evaluate` route to Poll `/api/workflow/status?id=...` to update frontend in near real-time  


## 🧭 3. Observability & Reliability Prompts

### 🔍 Logging Prompt
> Codex, add structured logs for every major operation:
> console.log(JSON.stringify({
>   event: "trade_evaluation",
>   leagueId,
>   step,
>   durationMs,
>   success
> }));



## 🧠 4. Performance & Caching Prompts

### 🚀 Edge Performance Prompt
> Codex, rewrite critical handlers using streaming JSON responses to reduce TTFB:
> ```ts
> return new Response(JSON.stringify(data), { headers, status })
> ```
> - Avoid synchronous logging inside hot paths  
> - Keep Worker cold start < 5ms by deferring imports  
> - Pre-warm AI and Vectorize bindings on init  

### 🧩 Cache Strategy Prompt
> Codex, layer caching as follows:
> - **Browser cache:** 5 minutes for static assets  
> - **Cloudflare edge cache:** 30 seconds for `/api/memory/get`  
> - **Durable cache:** 1 hour trade memory TTL in DO  

---

## 🌍 5. Developer-Facing Codex Prompts

### 🧑‍💻 Prompt: “Refactor for Cloudflare Pages”
> Refactor the existing HTML/JS frontend to be deployable via **Cloudflare Pages**:
> - Use `wrangler pages deploy frontend/`  
> - Convert `app.js` into ES module importing API base dynamically  
> - Add a build script to minify and hash static assets  
> - Route `/api/*` calls to the Worker subdomain automatically

### 🧑‍💻 Prompt: “Automate Workflows Testing”
> Codex, build a `test/trade-evaluate.test.ts` file that:
> - Initializes a demo league  
> - Triggers a workflow with a test trade  
> - Polls `instances describe latest` via Wrangler  
> - Asserts that `evaluation.grade` is returned  

### 🧑‍💻 Prompt: “Optimize Workflow Logs”
> Refactor step logging to include Workflow instance ID, latency, and retry count.  
> Example:
> ```ts
> await step.do("evaluate-trade", async () => {
>   const start = Date.now();
>   const result = await evaluateTrade(...);
>   console.log(`[WF] step:evaluate-trade duration=${Date.now() - start}ms`);
>   return result;
> });
> ```
---
