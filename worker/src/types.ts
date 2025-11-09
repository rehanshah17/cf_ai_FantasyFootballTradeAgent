type GeneratedEnv = Cloudflare.Env;
export type Env = GeneratedEnv;


export type Player = {
  id: string;
  name: string;
  team: string;
  pos: string[]; // e.g., ["G"], ["F"], ["C"], ["G","F"]
  proj: number; // projected fantasy points or value units
  injury?: { status: "O" | "DTD" | "OK"; note?: string };
};

export type Team = {
  id: string;
  name: string;
  needs: string[]; // e.g., ["rim_protection","threes","assists"]
  roster: string[]; // player ids
};

export type League = {
  leagueId: string;
  teams: Team[];
  players: Player[];
  rules: Record<string, unknown>; // scoring, slots, keepers, etc.
  history: TradeRecord[];
};

export type TradeProposal = {
  leagueId: string;
  fromTeamId: string;
  toTeamId: string;
  give: string[]; // player ids from fromTeam
  get: string[]; // player ids from toTeam
};

export type TradeEvaluation = {
  grade: "A" | "B" | "C" | "D" | "F";
  deltaValueFrom: number; // fromTeam net change
  deltaValueTo: number; // toTeam net change
  risks: string[];
  comps: string[]; // similar trades
  personaWriteup: string;
};

export type TradeRecord = {
  timestamp: number;
  fromTeamId: string;
  toTeamId: string;
  give: string[];
  get: string[];
  result: TradeEvaluation;
};
