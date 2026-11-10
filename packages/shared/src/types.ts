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
  hiding: boolean;
  kills: number;
  diedInRound: number | null;
};

export type Tribute = TributeConfig & TributeState;

export type WeaponDefinition = {
  weaponDefinitionId: string | null;
  name: string;
  power: number;
  foragingBonus: number;
  scalesWith: keyof Stats;
  startingAmmunition: number | null;
  ranged: boolean; // a target hit by a ranged weapon can't fight back that round
};

export type WeaponInstance = {
  kind: "weapon";
  itemId: string;
  definitionId: string | null; // weaponDefinitionId
  ammunition: number | null;
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
  result: MatchResults | null;
};

// Intent: what a tribute tries to do. The engine decides what actually happens.
export type Action =
  | { type: "forage" }
  | { type: "hide" }
  | { type: "rest" }
  | { type: "hunt"; targetId: TributeId }
  | { type: "betray"; allyId: TributeId }
  | { type: "propose_alliance"; tributeId: TributeId }
  | { type: "accept_alliance"; proposerId: TributeId }
  | { type: "move_to"; zoneId: ZoneId };

// Engine input (not an Action): applied at the first round that hasn't been simulated yet
export type SponsorGift = {
  giftId: string; // idempotency key
  from: PlayerId | null;
  to: TributeId;
  itemDefinitionId: string;
  appliesInRound: number;
};

// Outcomes: past tense, versioned. "Changed" events carry the delta and the new value.
type EventBase = {
  matchId: MatchId;
  seq: number;
  round: number;
  location: ZoneId;
  v: 1;
};

export type DeathCause =
  | { kind: "attack"; killerId: TributeId }
  | { kind: "hunger" }
  | { kind: "hazard"; hazard: string }; // narrow to a Hazard union in step 10

export type TributeDied = EventBase & {
  type: "TributeDied";
  victimId: TributeId;
  cause: DeathCause;
};

export type TributeHungerChanged = EventBase & {
  type: "TributeHungerChanged";
  tributeId: TributeId;
  delta: number; // positive = hungrier
  hunger: number;
};

export type TributeHealthChanged = EventBase & {
  type: "TributeHealthChanged";
  tributeId: TributeId;
  delta: number; // positive = healed
  hp: number;
};

export type TributeForaged = EventBase & {
  type: "TributeForaged";
  tributeId: TributeId;
  success: boolean;
};

export type TributeHid = EventBase & {
  type: "TributeHid";
  tributeId: TributeId;
};

export type TributeRested = EventBase & {
  type: "TributeRested";
  tributeId: TributeId;
};

export type TributeChangedZone = EventBase & {
  type: "TributeChangedZone";
  tributeId: TributeId;
  previousZoneId: ZoneId;
  currentZoneId: ZoneId;
};

export type TributeAttacked = EventBase & {
  type: "TributeAttacked";
  attackerId: TributeId;
  victimId: TributeId;
  outcome: "hit" | "missed" | "notFound" | "targetGone" | "pinnedDown";
  weaponDefinitionId: string | null;
};

export type TributeAmmunitionChanged = EventBase & {
  type: "TributeAmmunitionChanged";
  tributeId: TributeId;
  itemId: string;
  delta: number;
  ammunition: number;
};

export type TributeGainedItem = EventBase & {
  type: "TributeGainedItem";
  tributeId: TributeId;
  item: InventoryItem;
};

export type TributeUsedItem = EventBase & {
  type: "TributeUsedItem";
  tributeId: TributeId;
  item: SponsorItemInstance;
};

export type TributeBetrayedAlliance = EventBase & {
  type: "TributeBetrayedAlliance";
  betrayerId: TributeId;
  allianceId: string;
};

export type TributeReceivedGift = EventBase & {
  type: "TributeReceivedGift";
  recipientId: TributeId;
  senderId: PlayerId | null;
  itemDefinitionId: string;
  giftId: string;
  appliedInRound: number;
};

export type ZoneFoodChanged = EventBase & {
  type: "ZoneFoodChanged";
  zoneId: ZoneId;
  delta: number;
  food: number;
};

export type ZoneWaterChanged = EventBase & {
  type: "ZoneWaterChanged";
  zoneId: ZoneId;
  delta: number;
  water: number;
};

export type ZoneFlooded = EventBase & {
  type: "ZoneFlooded";
  zoneId: ZoneId;
};

export type ZoneClosed = EventBase & {
  type: "ZoneClosed";
  zoneId: ZoneId;
};

export type MatchEnded = EventBase & {
  type: "MatchEnded";
  result: MatchResults;
};

export type GameEvent =
  | TributeDied
  | TributeHungerChanged
  | TributeHealthChanged
  | TributeForaged
  | TributeHid
  | TributeRested
  | TributeChangedZone
  | TributeAttacked
  | TributeAmmunitionChanged
  | TributeGainedItem
  | TributeUsedItem
  | TributeBetrayedAlliance
  | TributeReceivedGift
  | ZoneFoodChanged
  | ZoneWaterChanged
  | ZoneFlooded
  | ZoneClosed
  | MatchEnded;

export type MatchResults = {
  rounds: number;
  winnerId: TributeId;
  placements: TributeId[];
} & (
  | { kind: "lastStanding" }
  | {
      kind: "tiebreak";
      cause: "draw" | "timeout";
      tiedIds: TributeId[];
      rule: "hp" | "kills" | "roll";
    }
);

export type Perception = {
  round: number;
  self: {
    tributeId: TributeId;
    hp: number;
    hunger: number;
    stats: Stats;
    position: ZoneId;
    inventory: InventoryItem[];
  };
  zone: { zoneId: ZoneId; food: number; water: number; cover: number };
  adjacentZoneIds: ZoneId[]; // → valid move_to targets
  visibleTributes: {
    tributeId: TributeId;
    name: string;
    hidLastRound: boolean;
  }[]; // same zone, alive, hidLastRound → valid hunt targets
  // later (step 9): recent events this tribute witnessed, memory, relationship tags
};

export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  chance: (p: number) => boolean;
  pick: <T>(arr: T[]) => T;
  shuffle: <T>(arr: T[]) => T[];
  getState: () => number;
};

export type RoundActions = Record<TributeId, Action>;