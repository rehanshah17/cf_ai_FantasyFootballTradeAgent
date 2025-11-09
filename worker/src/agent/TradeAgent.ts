import { computeTeamValueDelta } from "../services/value";
import { riskFlags } from "../services/risk";
import { similarTrades } from "../services/comps";
import { personaWriteup } from "../llm/writeup";
import { Env, League, TradeEvaluation, TradeProposal, Player, Team } from "../types";

const GRADE_THRESHOLDS: Array<{ min: number; grade: TradeEvaluation["grade"] }> = [
  { min: 5, grade: "A" },
  { min: 2, grade: "B" },
  { min: 0, grade: "C" },
  { min: -2, grade: "D" },
];

function gradeTrade(deltaFrom: number, deltaTo: number): TradeEvaluation["grade"] {
  const smallestGain = Math.min(deltaFrom, deltaTo);
  const bucket = GRADE_THRESHOLDS.find((threshold) => smallestGain >= threshold.min);
  return bucket?.grade ?? "F";
}

export async function evaluateTrade(
  env: Env,
  league: League,
  proposal: TradeProposal,
  persona = "Default"
): Promise<TradeEvaluation> {
  const players = Object.fromEntries(league.players.map((player) => [player.id, player]));
  const teams = Object.fromEntries(league.teams.map((team) => [team.id, team]));

  const { deltaFrom, deltaTo } = computeTeamValueDelta(players, teams, proposal);
  const risks = [...riskFlags(players, proposal.give), ...riskFlags(players, proposal.get)];
  let comps: string[] = [];
  try {
    const tradeSummary = buildTradeSummary(proposal, players, teams);
    comps = await similarTrades(env, tradeSummary);
  } catch (err) {
    // If embeddings/vector search fails, proceed without comps instead of failing the evaluation.
    console.warn("similarTrades failed:", err);
    comps = [];
  }
  const grade = gradeTrade(deltaFrom, deltaTo);

  const baseEvaluation: Omit<TradeEvaluation, "personaWriteup"> = {
    grade,
    deltaValueFrom: deltaFrom,
    deltaValueTo: deltaTo,
    risks,
    comps,
  };

  const personaWrite = await personaWriteup(env, persona, proposal, baseEvaluation);

  return { ...baseEvaluation, personaWriteup: personaWrite };
}

function buildTradeSummary(
  proposal: TradeProposal,
  players: Record<string, Player>,
  teams: Record<string, Team>
): string {
  const describePlayer = (id: string) => {
    const player = players[id];
    if (!player) return id;
    const pos = player.pos?.[0] ? `${player.pos[0]} ` : "";
    return `${pos}${player.name}`;
  };

  const giveList = proposal.give.map(describePlayer).join(", ");
  const getList = proposal.get.map(describePlayer).join(", ");
  const fromTeam = teams[proposal.fromTeamId]?.name ?? proposal.fromTeamId;
  const toTeam = teams[proposal.toTeamId]?.name ?? proposal.toTeamId;

  return `Team ${fromTeam} trades ${giveList || "players"} to Team ${toTeam} for ${
    getList || "players"
  } in fantasy football.`;
}
