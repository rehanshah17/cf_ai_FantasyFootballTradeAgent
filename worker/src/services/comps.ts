import { Env, TradeRecord } from "../types";

type EmbeddingVector = number[];
// Workers AI BGE embeddings return `embedding`, not `values`.
type EmbeddingResponse = { data?: Array<{ embedding: EmbeddingVector } | { values: EmbeddingVector }> };

async function embedText(env: Env, text: string): Promise<EmbeddingVector> {
  const result = (await env.AI.run("@cf/baai/bge-base-en-v1.5", { text })) as EmbeddingResponse;
  const first = result.data?.[0] as any;
  const vector: EmbeddingVector | undefined = first?.embedding ?? first?.values;

  if (!Array.isArray(vector) || vector.length !== 768) {
    throw new Error(`Embedding error: expected 768 dims, got ${Array.isArray(vector) ? vector.length : 0}`);
  }
  return vector;
}

export async function addTradeComp(env: Env, trade: TradeRecord) {
  const text = `${trade.fromTeamId} sent ${trade.give.join(", ")} for ${trade.get.join(", ")} to ${trade.toTeamId}`;
  const vector = await embedText(env, text);

  await env.VECTORIZE.insert([
    {
      id: String(trade.timestamp),
      values: vector,
      metadata: { text },
    },
  ]);
}

export async function similarTrades(env: Env, query: string, k = 5): Promise<string[]> {
  const vector = await embedText(env, query);
  const results = await env.VECTORIZE.query(vector, { topK: k, returnMetadata: true });

  return (
    results.matches?.map((match: { metadata?: { text?: string }; id: string }) =>
      String(match.metadata?.text ?? match.id)
    ) ?? []
  );
}
