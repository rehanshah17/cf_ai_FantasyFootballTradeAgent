import { Env, TradeRecord } from "../types";

type EmbeddingVector = number[];
// Workers AI BGE embeddings return `embedding`, not `values`.
type EmbeddingResponse = { data?: Array<{ embedding: EmbeddingVector } | { values: EmbeddingVector }> };

async function embedText(env: Env, text: string, scope: string): Promise<EmbeddingVector | null> {
  if (!text || !text.trim()) {
    console.warn(`[${scope}] similarTrades skipped: empty input`);
    return null;
  }

  let result: EmbeddingResponse | null = null;
  try {
    // Send as an array to ensure the model generates a vector per entry.
    result = (await env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: [text],
      pooling: "cls",
    })) as EmbeddingResponse;
  } catch (err) {
    console.warn(`[${scope}] embedding call failed`, { error: err, textPreview: text.slice(0, 80) });
    return null;
  }

  const first = result?.data?.[0];
  const vector: EmbeddingVector | undefined = Array.isArray(first)
    ? (first as EmbeddingVector)
    : (first as any)?.embedding ?? (first as any)?.values;

  if (!Array.isArray(vector) || vector.length !== 768) {
    console.warn(
      `[${scope}] similarTrades skipped: invalid embedding vector`,
      { length: Array.isArray(vector) ? vector.length : 0, textPreview: text.slice(0, 80) }
    );
    return null;
  }

  return vector;
}

export async function addTradeComp(env: Env, trade: TradeRecord) {
  const text = `${trade.fromTeamId} sent ${trade.give.join(", ")} for ${trade.get.join(", ")} to ${trade.toTeamId}`;
  const vector = await embedText(env, text, "addTradeComp");
  if (!vector) {
    console.warn("[addTradeComp] skipped vector insert due to missing embedding");
    return;
  }

  await env.VECTORIZE.insert([
    {
      id: String(trade.timestamp),
      values: vector,
      metadata: { text },
    },
  ]);
}

export async function similarTrades(env: Env, query: string, k = 5): Promise<string[]> {
  if (!query || !query.trim()) {
    console.warn("[similarTrades] skipped: empty query string");
    return [];
  }

  console.log("[similarTrades] textPreview:", query.slice(0, 160));
  const vector = await embedText(env, query, "similarTrades");
  if (!vector) {
    return [];
  }

  console.log("[similarTrades] vector length:", vector.length);
  const results = await env.VECTORIZE.query(vector, { topK: k, returnMetadata: true });
  const matches =
    results.matches?.map((match: { metadata?: { text?: string }; id: string }) =>
      String(match.metadata?.text ?? match.id)
    ) ?? [];

  console.log("[similarTrades] returned matches", { count: matches.length });

  return matches;
}
