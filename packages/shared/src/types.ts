// Transcribed from docs/data-model.md. Keep the two in sync.

export type PlayerId = string;
export type TributeId = string;
export type ZoneId = string;
export type MatchId = string;
export type ArenaId = string;

export type District =
  "Saltworks" | "Glassmouth" | "Blackfenn" | "The Quaries" | "Hollow Pines";

export type Stats = {
  strength: number;
  agility: number;
  charisma: number;
  endurance: number;
  intelligence: number;
  stealth: number;
};

// What the caller provides: fixed for the whole match
export type TributeConfig = {
  tributeId: TributeId;
  stats: Stats;
  name: string;
  origin: District;
  personality: string;
  startingWeaponDefId: string;
  owner: PlayerId | null; // null = AI-controlled
};

// What the engine creates at setup and changes during play
export type TributeState = {
  hp: number;
  hunger: number;
  position: ZoneId;
  alive: boolean;
  memory: string[];
  inventory: InventoryItem[];
};

export type Tribute = TributeConfig & TributeState;

export type WeaponDefinition = {
  weaponDefinitionId: string;
  name: string;
  range: number;
  attackSpeed: number;
  power: number;
  foragingBonus: number;
  scalesWith: keyof Stats;
};

export type WeaponInstance = {
  kind: "weapon";
  itemId: string;
  definitionId: string; // weaponDefinitionId
  ammunition: number;
};

export type SponsorItemDefinition = {
  itemDefinitionId: string;
  name: string;
  cost: number;
};

export type SponsorItemInstance = {
  kind: "sponsorItem";
  itemId: string;
  definitionId: string; // itemDefinitionId
};

export type InventoryItem = WeaponInstance | SponsorItemInstance;

export type Zone = {
  zoneId: ZoneId;
  name: string;
  food: number;
  water: number;
  cover: number;
  hazardLevel: number;
};

// Edges are {from, to}: allows one-way edges and per-edge cost
export type Edge = {
  from: ZoneId;
  to: ZoneId;
  cost: number;
};

export type ArenaDefinition = {
  arenaId: ArenaId;
  name: string;
  zones: Zone[];
  edges: Edge[];
  startingZoneIds: ZoneId[];
};

export type Alliance = {
  allianceId: string;
  memberIds: TributeId[];
};

export type MatchConfig = {
  matchId: MatchId;
  seed: number;
  arenaId: ArenaId;
  tributes: TributeConfig[];
};

export type GameState = {
  matchId: MatchId;
  arenaId: ArenaId;
  round: number;
  seq: number; // the seq the next event will get
  nextItemId: number; // the id number the next created item will get
  rngState: number;
  tributes: Tribute[];
  alliances: Alliance[]; // live here, not on Tribute: single source of truth
  zones: Zone[]; // per-match copy, since food and water change during play
};
