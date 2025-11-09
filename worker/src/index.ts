import { Router } from "itty-router";
import { evaluateTrade } from "./agent/TradeAgent";
import { LeagueState } from "./durable/LeagueState";
import { Env, League, TradeProposal } from "./types";

const router = Router();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const JSON_HEADERS = { "content-type": "application/json" } as const;
const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data: unknown, init?: ResponseInit) {
  return withCors(
    new Response(JSON.stringify(data), {
      headers: JSON_HEADERS,
      ...init,
    })
  );
}

function ensureLeagueBinding(env: Env) {
  if (!env.LEAGUE_STATE) {
    throw new Error("LEAGUE_STATE binding not configured");
  }
  return env.LEAGUE_STATE;
}

async function readRequestBody<T>(request: Request): Promise<T> {
  const body = await request.text();
  if (!body.trim()) {
    throw new Error("Request body is required");
  }
  return JSON.parse(body) as T;
}

async function fetchLeague(env: Env, leagueId: string): Promise<League | null> {
  const namespace = ensureLeagueBinding(env);
  const stub = namespace.get(namespace.idFromName(leagueId));
  const response = await stub.fetch("https://do/get");

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load league: ${response.status}`);
  }

  const text = await response.text();
  if (!text) return null;

  const data = JSON.parse(text);
  return data?.league ?? data;
}


async function appendLeagueHistory(env: Env, leagueId: string, payload: unknown) {
  try {
    const namespace = ensureLeagueBinding(env);
    const stub = namespace.get(namespace.idFromName(leagueId));
    await stub.fetch("https://do/append", { method: "POST", body: JSON.stringify(payload) });
  } catch (error) {
    console.warn("Unable to append trade history:", error);
  }
}

router.options("*", () => withCors(new Response(null, { status: 204 })));

router.post("/api/league/init", async (req, env: Env) => {
  try {
    const body = await req.json<League>();

    if (!body?.leagueId) {
      return new Response(
        JSON.stringify({ error: "Missing leagueId" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const id = env.LEAGUE_STATE.idFromName(body.leagueId);
    const stub = env.LEAGUE_STATE.get(id);

    // NOTE: must match LeagueState.ts route
    const resp = await stub.fetch("https://do/put", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("❌ Durable Object PUT failed:", text);
      return new Response(
        JSON.stringify({ error: "Failed to initialize league", details: text }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const text = await resp.text();
    console.log("✅ League initialized:", text);

    return new Response(text, {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("❌ Error initializing league:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
});

router.post("/api/trade/evaluate", async (request, env: Env) => {
  try {
    const body = await readRequestBody<{ proposal: TradeProposal; persona?: string }>(request);
    const proposal = body?.proposal;
    const persona = body?.persona ?? "Default";

    if (!proposal || typeof proposal !== "object") {
      return jsonResponse({ error: "proposal is required" }, { status: 400 });
    }
    if (!proposal.leagueId?.trim()) {
      return jsonResponse({ error: "proposal.leagueId is required" }, { status: 400 });
    }

    // Kick off workflow instead of inline evaluation
    if (!env.EVALUATE_TRADE) {
      return jsonResponse({ error: "EVALUATE_TRADE workflow binding not configured" }, { status: 502 });
    }

    // Debug logs for payload shape and workflow binding
    try {
      console.log("[API] /api/trade/evaluate body keys:", Object.keys(body || {}));
      console.log("[API] /api/trade/evaluate proposal:", {
        leagueId: proposal.leagueId,
        from: proposal.fromTeamId,
        to: proposal.toTeamId,
        give: proposal.give?.length,
        get: proposal.get?.length,
        persona,
      });
      console.log("[API] Workflow binding present?", !!env.EVALUATE_TRADE);
    } catch (e) {
      console.warn("[API] Failed to log request summary", e);
    }

    const workflowId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `wf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const wfPayload = { workflowId, leagueId: proposal.leagueId, proposal, persona };
    console.log("[API] Starting workflow with payload:", JSON.stringify(wfPayload));

    try {
      await env.EVALUATE_TRADE.create({ id: workflowId, params: wfPayload });
      console.log("[API] Workflow created", { id: workflowId });
      return jsonResponse({ id: workflowId, status: "queued" }, { status: 202 });
    } catch (err) {
      console.error("[API] Workflow execution failed", err);
      throw err;
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Trade evaluation failed";
    if (typeof message === "string" && message.includes("LEAGUE_STATE binding not configured")) {
      return jsonResponse(
        {
          error: "LEAGUE_STATE binding not configured",
          hint:
            'Add a Durable Object binding in wrangler.toml: [[durable_objects.bindings]] name = "LEAGUE_STATE" class_name = "LeagueState" and include a migration with new_classes = ["LeagueState"].',
        },
        { status: 502 }
      );
    }
    return jsonResponse({ error: message }, { status: 500 });
  }
});

router.get("/api/memory/get", async (request, env: Env) => {
  try {
    const url = new URL(request.url);
    const leagueId = url.searchParams.get("leagueId")?.trim();
    if (!leagueId) {
      return jsonResponse({ error: "leagueId is required" }, { status: 400 });
    }

    let namespace: ReturnType<typeof ensureLeagueBinding>;
    try {
      namespace = ensureLeagueBinding(env);
    } catch {
      return jsonResponse(
        {
          error: "LEAGUE_STATE binding not configured",
          hint:
            'Add a Durable Object binding in wrangler.toml: [[durable_objects.bindings]] name = "LEAGUE_STATE" class_name = "LeagueState" and include a migration with new_classes = ["LeagueState"].',
        },
        { status: 502 }
      );
    }

    const stub = namespace.get(namespace.idFromName(leagueId));
    const response = await stub.fetch("https://do/memory");
    if (!response.ok) {
      return jsonResponse({ error: `Failed to fetch memory: ${response.status}` }, { status: 500 });
    }

    const text = await response.text();
    return withCors(new Response(text, { headers: JSON_HEADERS }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch memory";
    return jsonResponse({ error: message }, { status: 500 });
  }
});

router.get("/api/trade/status", async (request, env: Env) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return jsonResponse({ error: "Missing id" }, { status: 400 });
    }

    const instance = await env.EVALUATE_TRADE.get(id);
    const status = await instance.status();
    return jsonResponse(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch workflow status";
    return jsonResponse({ error: message }, { status: 500 });
  }
});

async function streamResponseWithCors(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

router.get("/api/stream", async (request, env: Env) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return jsonResponse({ error: "Missing id" }, { status: 400 });
    }

    if (!env.STREAM_HUB) {
      return jsonResponse({ error: "STREAM_HUB binding not configured" }, { status: 500 });
    }

    const stub = env.STREAM_HUB.get(env.STREAM_HUB.idFromName(id));
    const response = await stub.fetch("https://hub/connect", {
      headers: { Accept: "text/event-stream" },
    });
    return streamResponseWithCors(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open stream";
    return jsonResponse({ error: message }, { status: 500 });
  }
});

router.all("*", () => jsonResponse({ error: "Not Found" }, { status: 404 }));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!ALLOWED_METHODS.has(request.method)) {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      const response = await router.handle(request, env);
      return response ? withCors(response) : jsonResponse({ error: "Not Found" }, { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request handling failed";
      return jsonResponse({ error: message }, { status: 500 });
    }
  },
};

export { LeagueState };
export { EvaluateTradeWorkflow } from "./workflows/EvaluateTradeWorkflow";
export { StreamHub } from "./durable/StreamHub";
