import { League, TradeRecord } from "../types";


export class LeagueState {
state: DurableObjectState;
storage: DurableObjectStorage;


constructor(state: DurableObjectState) {
this.state = state;
this.storage = state.storage;
}


async getLeague(): Promise<League | null> {
return (await this.storage.get<League>("league")) ?? null;
}


async putLeague(league: League) {
await this.storage.put("league", league);
}


async appendHistory(record: TradeRecord) {
	const league = (await this.getLeague());
	if (!league) throw new Error("League not initialized");
	league.history.push(record);
	await this.putLeague(league);
}

async fetch(req: Request): Promise<Response> {
	const url = new URL(req.url);
	
	if (req.method === "PUT" && url.pathname === "/put") {
		const league = await req.json<League>();
		await this.putLeague(league);
		return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
	}
	
	if (req.method === "GET" && url.pathname === "/get") {
		const league = await this.getLeague();
		return new Response(JSON.stringify(league), { headers: { "content-type": "application/json" } });
	}
	
	if (req.method === "POST" && url.pathname === "/append") {
		const { proposal, result } = await req.json<{ proposal: any; result: any }>();
		await this.appendHistory({
			timestamp: Date.now(),
			fromTeamId: proposal.fromTeamId,
			toTeamId: proposal.toTeamId,
			give: proposal.give,
			get: proposal.get,
			result
		});
		return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
	}
	
	return new Response("Not found", { status: 404 });
}
}
