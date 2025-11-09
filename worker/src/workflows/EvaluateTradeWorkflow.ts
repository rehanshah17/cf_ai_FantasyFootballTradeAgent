import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import { evaluateTrade } from "../agent/TradeAgent";
import type { Env, League, TradeEvaluation, TradeProposal } from "../types";

type Input = {
  workflowId: string;
  leagueId: string;
  proposal: TradeProposal;
  persona?: string;
};

type Output = { ok: true; evaluation: TradeEvaluation };

export class EvaluateTradeWorkflow extends WorkflowEntrypoint<Input, Output> {
  async run(event: any, step: WorkflowStep): Promise<Output> {
    // Debug traces for input shape
    try {
      console.log("[WF] Run invoked. Raw event type:", typeof event);
      console.log("[WF] Raw event keys:", event && typeof event === "object" ? Object.keys(event) : null);
      console.log("[WF] event.input keys:", event?.input && typeof event.input === "object" ? Object.keys(event.input) : null);
      console.log("[WF] event.payload keys:", event?.payload && typeof event.payload === "object" ? Object.keys(event.payload) : null);
      console.log("[WF] event.input.input keys:", event?.input?.input && typeof event.input.input === "object" ? Object.keys(event.input.input) : null);
    } catch (e) {
      console.warn("[WF] Failed to log event shape", e);
    }

    // Accept multiple possible wrappers for workflow input
    const candidates: unknown[] = [event?.input, event?.payload, event, event?.input?.input, event?.payload?.input];
    let payload: Input | undefined;
    for (const cand of candidates) {
      if (cand && typeof cand === "object" && "leagueId" in (cand as any) && "proposal" in (cand as any)) {
        payload = cand as Input;
        break;
      }
    }

    if (!payload) {
      throw new Error("Workflow input missing leagueId/proposal. Check env.EVALUATE_TRADE.create payload.");
    }

    const { workflowId, leagueId, proposal, persona = "Default" } = payload;
    console.log("[WF] Resolved input:", { workflowId, leagueId, hasProposal: !!proposal, persona });
    const env = (this as unknown as { env: Env }).env;

    console.log("[WF] Fetching league...", { leagueId });
    const leagueText = await step.do("fetch-league", async (): Promise<string> => {
      if (!env.LEAGUE_STATE) throw new Error("LEAGUE_STATE binding not configured");
      const ns = env.LEAGUE_STATE;
      const stub = ns.get(ns.idFromName(leagueId));
      const resp = await stub.fetch("https://do/get");
      if (resp.status === 404) throw new Error("League not initialized");
      if (!resp.ok) throw new Error(`Failed to load league: ${resp.status}`);
      const text = await resp.text();
      if (!text) throw new Error("League missing or invalid");
      console.log("[WF] Fetched league text length:", text.length);
      return text;
    });
    const league = JSON.parse(leagueText) as League;
    console.log("[WF] Parsed leagueId:", league?.leagueId);

    console.log("[WF] Evaluating trade with persona...", { persona });
    const evaluation = await step.do("evaluate-trade", async (): Promise<TradeEvaluation> => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[WF] evaluateTrade attempt ${attempt}`);
          const result = await evaluateTrade(env, league, proposal, persona);
          return result;
        } catch (err) {
          lastErr = err;
          console.warn(`[WF] evaluateTrade failed (attempt ${attempt})`, err);
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    });
    console.log("[WF] Evaluation keys:", evaluation ? Object.keys(evaluation) : null);

    console.log("[WF] Appending result to history...");
    await step.do("append-history", async () => {
      try {
        const ns = env.LEAGUE_STATE;
        const stub = ns.get(ns.idFromName(leagueId));
        await stub.fetch("https://do/append", {
          method: "POST",
          body: JSON.stringify({ proposal, result: evaluation }),
        });
        console.log("[WF] History append dispatched");
      } catch (err) {
        console.warn("[WF] Failed to append history (non-fatal)", err);
      }
    });

    try {
      const memoryText = await step.do("fetch-memory", async (): Promise<string> => {
        const ns = env.LEAGUE_STATE;
        const stub = ns.get(ns.idFromName(leagueId));
        const r = await stub.fetch("https://do/memory");
        if (!r.ok) throw new Error(`memory fetch failed: ${r.status}`);
        return await r.text();
      });
      const memory = JSON.parse(memoryText) as { tradeCount?: number; lastUpdated?: string; personaNotes?: string };
      console.log("[WF] Memory state after append:", {
        tradeCount: memory?.tradeCount,
        lastUpdated: memory?.lastUpdated,
        hasNotes: !!memory?.personaNotes,
      });
    } catch (err) {
      console.warn("[WF] Unable to fetch memory after append (non-fatal)", err);
    }

    try {
      await step.do("notify-stream", async () => {
        try {
          if (!env.STREAM_HUB) return;
          const stub = env.STREAM_HUB.get(env.STREAM_HUB.idFromName(workflowId));
          await stub.fetch("https://hub/emit", {
            method: "POST",
            body: JSON.stringify({
              id: workflowId,
              status: "complete",
              output: { ok: true, evaluation },
            }),
          });
          console.log("[WF] Stream notification emitted", workflowId);
        } catch (err) {
          console.warn("[WF] Failed to emit stream update", err);
        }
      });
    } catch (err) {
      console.warn("[WF] notify-stream step failed", err);
    }

    console.log("[WF] Completed evaluation");
    return { ok: true, evaluation };
  }
}
