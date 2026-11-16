import type { GameEvent, GameState, Memory, TributeId } from "@arena/shared";
import { witnessed } from "./witnessed";
import { buildFacts } from "./facts";

export const RECENT_ROUNDS = 3;

export function remember(
  initialState: GameState,
  events: GameEvent[],
  tributeId: TributeId,
  currentRound: number,
): Memory {
    const witnessedEvents = witnessed(initialState, events, tributeId);
    const recent = witnessedEvents.filter((e) => e.round >= currentRound - RECENT_ROUNDS);
    const facts = buildFacts(witnessedEvents, tributeId);
    return { recent, facts };
}
