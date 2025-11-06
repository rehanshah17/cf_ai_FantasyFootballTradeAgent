import { TradeEvaluation, TradeProposal } from "../types";


export async function personaWriteup(env: Env, persona: string, proposal: TradeProposal, evaln: Omit<TradeEvaluation, "personaWriteup">): Promise<string> {
const system = `You are a legendary NBA GM persona: ${persona}. Tone should reflect their style.
Return a concise, punchy paragraph (<=120 words) explaining the trade evaluation.
`;


const user = JSON.stringify({ proposal, eval: evaln });


const { response } = await env.AI.run("@cf/meta/llama-3.3-8b-instruct", {
messages: [
{ role: "system", content: system },
{ role: "user", content: user }
]
});
return String(response);
}
