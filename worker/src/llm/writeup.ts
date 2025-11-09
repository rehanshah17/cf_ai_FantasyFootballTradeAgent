import { TradeEvaluation, TradeProposal, Env } from "../types";

const PERSONA_STYLES: Record<string, string> = {
  "Analytics Bot":
    "Speak like a robotic front-office analytics assistant. Prioritize projected value deltas, variance, and injury risk. Keep it concise and number-heavy.",
  SchefterBot:
    "Deliver the summary like Adam Schefter breaking news. Use phrases like 'Per sources' and discuss both sides quickly, highlighting who the early grades favor.",
  "Stephen A. Smith":
    "Channel Stephen A. Smith's emphatic television persona. Start with a dramatic exclamation such as 'This is egregious! Outrageous!' and lean into emotional, opinionated commentary.",
};

export async function personaWriteup(
  env: Env,
  persona: string,
  proposal: TradeProposal,
  evaluation: Omit<TradeEvaluation, "personaWriteup">
): Promise<string> {
  const personaDirective =
    PERSONA_STYLES[persona] ??
    `You are a legendary NFL GM persona: ${persona}. Keep the tone tight and grounded in roster construction. Explain the fairness of the swap in <=120 words.`;

  const system = [
    personaDirective,
    "Always reference the relative gain/loss for each team.",
    "Stay under 120 words.",
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
