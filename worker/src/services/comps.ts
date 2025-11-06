import { TradeRecord } from "../types";


export async function embedText(env: Env, text: string) {
// Use Workers AI embeddings
const { data } = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text });
return data[0];
}


export async function addTradeComp(env: Env, trade: TradeRecord) {
const text = `${trade.fromTeamId} sent ${trade.give.join(",")} for ${trade.get.join(",")} to ${trade.toTeamId}`;
const vector = await embedText(env as any, text);
await env.VECTORIZE.insert([{ id: String(trade.timestamp), values: vector, metadata: { text } }]);
}


export async function similarTrades(env: Env, query: string, k = 5): Promise<string[]> {
const vector = await embedText(env as any, query);
const results = await env.VECTORIZE.query(vector, { topK: k, returnMetadata: true });
return results.matches?.map(m => String(m.metadata?.text || m.id)) ?? [];
}
