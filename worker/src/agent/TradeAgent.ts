import { computeTeamValueDelta } from "../services/value";
import { riskFlags } from "../services/risk";
import { similarTrades } from "../services/comps";
import { personaWriteup } from "../llm/writeup";
import { League, TradeEvaluation, TradeProposal,Env } from "../types";


export async function evaluateTrade(env: Env, league: League, proposal: TradeProposal, persona = "Default"): Promise<TradeEvaluation> {
const players = Object.fromEntries(league.players.map(p => [p.id, p]));
const teams = Object.fromEntries(league.teams.map(t => [t.id, t]));


const { deltaFrom, deltaTo } = computeTeamValueDelta(players, teams, proposal);
const risks = [
...riskFlags(players, proposal.give),
...riskFlags(players, proposal.get)
];


const comps = await similarTrades(env, `give:${proposal.give.join(',')} get:${proposal.get.join(',')}`);


const grade = ((): TradeEvaluation["grade"] => {
const m = Math.min(deltaFrom, deltaTo);
if (m > 5) return "A";
if (m > 2) return "B";
if (m > 0) return "C";
if (m > -2) return "D";
return "F";
})();


const base = { grade, deltaValueFrom: deltaFrom, deltaValueTo: deltaTo, risks, comps } as Omit<TradeEvaluation, "personaWriteup">;
const personaWrite = await personaWriteup(env, persona, proposal, base);


return { ...base, personaWriteup: personaWrite };
}
