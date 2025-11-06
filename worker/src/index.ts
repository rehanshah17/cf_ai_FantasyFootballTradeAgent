import { Router } from "itty-router";
import { Env, League, TradeProposal } from "./types";
import { evaluateTrade } from "./agent/TradeAgent";
import { LeagueState } from "./durable/LeagueState";

const router = Router();

router.post("/api/league/init", async (req, env: Env) => {
	const body = await req.json<{ leagueId: string; league: League }>();
	const { leagueId, league } = body || {};
	if (!leagueId || !league) return new Response("leagueId and league required", { status: 400 });
	const id = env.LEAGUE_STATE.idFromName(leagueId);
	const stub = env.LEAGUE_STATE.get(id);
	const r = await stub.fetch("https://do/put", { method: "PUT", body: JSON.stringify(league) });
	return new Response(await r.text(), { headers: { "content-type": "application/json" } });
});

router.post("/api/trade/evaluate", async (req, env: Env) => {
	const body = await req.json<{ proposal: TradeProposal; persona?: string }>();
	const { proposal, persona = "Default" } = body || {};
	if (!proposal?.leagueId) return new Response("proposal.leagueId required", { status: 400 });
	const id = env.LEAGUE_STATE.idFromName(proposal.leagueId);
	const stub = env.LEAGUE_STATE.get(id);
	const lr = await stub.fetch("https://do/get");
	const league = (await lr.json()) as League | null;
	if (!league) return new Response("League not initialized", { status: 400 });
	const result = await evaluateTrade(env, league, proposal, persona);
	// (Optional) append to history inside DO
	await stub.fetch("https://do/append", { method: "POST", body: JSON.stringify({ proposal, result }) });
	return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
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
