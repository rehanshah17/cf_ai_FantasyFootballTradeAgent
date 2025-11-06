import { Player } from "../types";


export function riskFlags(players: Record<string, Player>, ids: string[]): string[] {
const flags: string[] = [];
for (const id of ids) {
const p = players[id];
if (!p) continue;
if (p.injury?.status === "O") flags.push(`${p.name}: OUT`);
else if (p.injury?.status === "DTD") flags.push(`${p.name}: day-to-day`);
}
return flags;
}
