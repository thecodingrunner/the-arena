import type { ArenaDefinition, GameEvent, GameState, Rng, Zone } from "@arena/shared";

export type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

export type EventInput = DistributiveOmit<
  GameEvent,
  "matchId" | "round" | "seq" | "v"
>;

export type Ctx = {
  zones: Zone[];
  rng: Rng;
  edges: ArenaDefinition["edges"];
  emitEvent: (e: EventInput) => void;
  copiedGameState: GameState;
  pinned: Set<string>;
};