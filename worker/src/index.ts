import { Router } from "itty-router";
import { Env, League, TradeProposal } from "./types";
import { evaluateTrade } from "./agent/TradeAgent";
import { LeagueState } from "./durable/LeagueState";

const router = Router();

router.post("/api/league/init", async (req, env: Env) => {
  try {
    const body = await req.json<League>();
    if (!body || !body.leagueId) {
      return new Response("Missing leagueId or invalid body", { status: 400 });
    }
    // Get the Durable Object instance by leagueId
    const id = env.LEAGUE_STATE.idFromName(body.leagueId);
    const stub = env.LEAGUE_STATE.get(id);
    // Store the league state inside the Durable Object
    const resp = await stub.fetch("https://do/put", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return new Response(await resp.text(), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error initializing league:", err);
    return new Response("Invalid JSON or internal error", { status: 400 });
  }
});


router.post("/api/trade/evaluate", async (req, env: Env) => {
  try {
    const body = await req.json<{ proposal: TradeProposal; persona?: string }>();
    const { proposal, persona = "Default" } = body || {};
    if (!proposal || !proposal.leagueId) {
      return new Response("proposal.leagueId required", { status: 400 });
    }
    // get league state from Durable Object
    const id = env.LEAGUE_STATE.idFromName(proposal.leagueId);
    const stub = env.LEAGUE_STATE.get(id);

    const leagueResp = await stub.fetch("https://do/get");
    const league = (await leagueResp.json()) as League | null;
    if (!league) {
      return new Response("League not initialized", { status: 400 });
    }
    // Run the trade evaluation logic
    const result = await evaluateTrade(env, league, proposal, persona);
    await stub.fetch("https://do/append", {
      method: "POST",
      body: JSON.stringify({ proposal, result }),
    });
    
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error evaluating trade:", err);
    return new Response("Invalid JSON or internal error", { status: 400 });
  }
});


// Static Pages fallback (optional):
router.get("/*", () => new Response("OK", { status: 200 }));

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return router.handle(request, env);
	},
};

// Export LeagueState for Durable Objects
export { LeagueState };
