// worker/src/durable/LeagueState.ts
import { Env, League, TradeEvaluation, TradeProposal } from "../types";

interface LeagueMemory {
  personaNotes: string;
  tradeCount: number;
  lastUpdated: string;
}

export class LeagueState {
  state: DurableObjectState;
  env: Env;
  league: League | null = null;
  history: { proposal: TradeProposal; result: TradeEvaluation }[] = [];
  memory: LeagueMemory = {
    personaNotes: "No memory yet. Make a few trades to see insights.",
    tradeCount: 0,
    lastUpdated: new Date().toISOString(),
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Ensure the in-memory cache is hydrated from storage at startup.
    // Durable Objects may be recreated between requests.
    this.state.blockConcurrencyWhile(async () => {
      try {
        const storedLeague = await this.state.storage.get<League>("league");
        const storedHistory = (await this.state.storage.get(
          "history"
        )) as Array<{ proposal: TradeProposal; result: TradeEvaluation }> | undefined;
        const storedMemory = (await this.state.storage.get(
          "memory"
        )) as LeagueMemory | undefined;

        this.league = storedLeague ?? null;
        this.history = Array.isArray(storedHistory) ? storedHistory : [];
        this.memory = storedMemory ?? this.memory;
      } catch (err) {
        console.warn("[LeagueState] Failed to hydrate from storage", err);
        this.league = this.league ?? null;
        this.history = this.history ?? [];
        this.memory = this.memory ?? {
          personaNotes: "No memory yet. Make a few trades to see insights.",
          tradeCount: 0,
          lastUpdated: new Date().toISOString(),
        };
      }
    });
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/put" && request.method === "PUT") {
	try {
		const data = await request.json<League>();

		if (!data?.leagueId) {
		throw new Error("Missing leagueId in request body");
		}

		this.league = data;
		await this.state.storage.put("league", data);
		console.log("League saved:", data.leagueId);

		return new Response(JSON.stringify({ ok: true, leagueId: data.leagueId }), {
		headers: { "content-type": "application/json" },
		status: 200,
		});
	} catch (err: any) {
		console.error("Failed to save league:", err);
		return new Response(
		JSON.stringify({ error: err.message || "Invalid league data" }),
		{ headers: { "content-type": "application/json" }, status: 400 }
		);
	}
	}

    if (url.pathname === "/get") {
      // Return the persisted league only; 404 if not initialized.
      const stored = (await this.state.storage.get<League>("league")) ?? this.league;
      if (!stored) {
        return new Response(JSON.stringify({ error: "League not initialized" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(stored), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/append" && request.method === "POST") {
      const record = await request.json<{ proposal: TradeProposal; result: TradeEvaluation }>();

      // Load from storage if cache is empty to avoid losing history across restarts.
      const historyFromStorage = (await this.state.storage.get("history")) as
        | Array<{ proposal: TradeProposal; result: TradeEvaluation }>
        | undefined;
      const memoryFromStorage = (await this.state.storage.get("memory")) as LeagueMemory | undefined;

      const storedHistory: Array<{ proposal: TradeProposal; result: TradeEvaluation }> = this.history.length
        ? this.history.slice()
        : Array.isArray(historyFromStorage)
        ? historyFromStorage.slice()
        : [];
      const storedMemory: LeagueMemory = this.memory && this.memory.lastUpdated
        ? { ...this.memory }
        : memoryFromStorage ?? this.memory;

      // Update history and memory
      storedHistory.push(record);
      if (storedHistory.length > 10) storedHistory.shift();

      storedMemory.tradeCount++;
      if (storedMemory.tradeCount % 3 === 0) {
        try {
          const { response } = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
            messages: [
              {
                role: "system",
                content:
                "You are a fantasy GM summarizing trade tendencies. Write 2–3 sentences about what trends or biases this user shows based on the trades below.",
              },
              { role: "user", content: JSON.stringify(storedHistory, null, 2) },
            ],
          });
          storedMemory.personaNotes = String(response);
          storedMemory.lastUpdated = new Date().toISOString();
        } catch (err) {
          console.error("⚠️ Memory summary generation failed:", err);
        }
      }

      // ✅ Persist updates
      await this.state.storage.put("history", storedHistory);
      await this.state.storage.put("memory", storedMemory);

      // Update in-memory refs for current session
      this.history = storedHistory;
      this.memory = storedMemory;

      console.log("✅ Memory updated, tradeCount =", storedMemory.tradeCount);

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }


    if (url.pathname === "/memory" && request.method === "GET") {
      const memory = await this.state.storage.get("memory");
      return new Response(
        JSON.stringify(memory || this.memory),
        { headers: { "content-type": "application/json" } }
      );
    }

    return new Response("Not found", { status: 404 });
  }
}
