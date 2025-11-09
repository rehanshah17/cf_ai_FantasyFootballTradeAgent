import { Player, Team, TradeProposal } from "../types";

export function computeTeamValueDelta(
  players: Record<string, Player>,
  teams: Record<string, Team>,
  proposal: TradeProposal
) {
  const { fromTeamId, toTeamId, give, get } = proposal;

  const sum = (ids: string[]) => ids.reduce((acc, id) => acc + (players[id]?.proj ?? 0), 0);

  const valueGive = sum(give);
  const valueGet = sum(get);

  const deltaFrom = valueGet - valueGive;
  const deltaTo = -deltaFrom; // symmetric for simple MVP

  return { deltaFrom, deltaTo };
}
