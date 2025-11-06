import { TradeEvaluation, TradeProposal,Env } from "../types";


export async function personaWriteup(
  env: Env,
  persona: string,
  proposal: TradeProposal,
  evaln: Omit<TradeEvaluation, "personaWriteup">
): Promise<string> {
  const system = `You are a legendary NBA GM persona: ${persona}.
Your tone should reflect their negotiation and analytical style.
Return a concise, punchy paragraph (≤120 words) explaining whether this trade is fair and why.`;

  const user = JSON.stringify({ proposal, eval: evaln });

    const { response } = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
    messages: [
        { role: "system", content: system },
        { role: "user", content: user },
    ],
    });



  return String(response);
}
