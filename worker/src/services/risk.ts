import { Player } from "../types";

export function riskFlags(players: Record<string, Player>, ids: string[]): string[] {
  const flags: string[] = [];

  for (const id of ids) {
    const player = players[id];
    if (!player) continue;

    if (player.injury?.status === "O") {
      flags.push(`${player.name}: OUT`);
    } else if (player.injury?.status === "DTD") {
      flags.push(`${player.name}: day-to-day`);
    }
  }

  return flags;
}
