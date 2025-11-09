import { TradeEvaluation, TradeProposal, Env } from "../types";

export async function personaWriteup(
  env: Env,
  persona: string,
  proposal: TradeProposal,
  evaluation: Omit<TradeEvaluation, "personaWriteup">
): Promise<string> {
  const system = [
    `You are a legendary NFL GM persona: ${persona}.`,
    "Keep the tone tight and grounded in roster construction.",
    "Explain the fairness of the swap in <=120 words.",
  ].join(" ");

  const user = JSON.stringify({ proposal, evaluation });

  const { response } = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  return String(response);
}
