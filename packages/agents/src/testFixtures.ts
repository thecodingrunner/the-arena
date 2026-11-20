import type {
  LlmResponse,
  ModelFailureReason,
  Perception,
  TributeConfig,
  WitnessedEvent,
} from "@arena/shared";
import type { ModelResult } from "./modelResult";

// Builds a valid, unremarkable Perception: every action type is possible
// (food to forage, two zones to move to, one tribute to hunt).
// Override only the fields a test cares about: makePerception({ visibleTributes: [] })
// Mirrors the placeholder arena: forest connects to centre and ridge.
export function makePerception(
  overrides: Partial<Perception> = {},
): Perception {
  return {
    round: 1,
    self: {
      tributeId: "t1",
      hp: 100,
      hunger: 0,
      stats: {
        strength: 5,
        agility: 5,
        charisma: 5,
        endurance: 5,
        intelligence: 5,
        stealth: 5,
      },
      position: "forest",
      inventory: [
        {
          kind: "weapon",
          itemId: "spear-0",
          definitionId: "spear",
          ammunition: null,
        },
      ],
      allyId: null
    },
    zone: { zoneId: "forest", food: 3, water: 1, cover: 2 },
    adjacentZoneIds: ["centre", "ridge"],
    visibleTributes: [
      { tributeId: "t2", name: "Tribute Two", hidLastRound: false, allyId: null },
    ],
    ...overrides,
  };
}

export function ev<E extends WitnessedEvent>(
  e: Omit<E, "matchId" | "seq" | "round" | "v">,
  seq: number = 0,
  round: number = 1
): E {
  return { matchId: "match-1", seq: seq++, round: round, v: 1, ...e } as E;
}

// A valid, unremarkable TributeConfig. The tributeId matches makePerception's self ("t1").
// Override only what a test cares about: makeTributeConfig({ tributeId: "t2", name: "Mara" })
export function makeTributeConfig(
  overrides: Partial<TributeConfig> = {},
): TributeConfig {
  return {
    tributeId: "t1",
    name: "Kael",
    personality: "Cautious and observant.",
    stats: {
      strength: 5,
      agility: 5,
      charisma: 5,
      endurance: 5,
      intelligence: 5,
      stealth: 5,
    },
    origin: "Saltworks",
    startingWeaponDefId: "spear",
    owner: null,
    ...overrides,
  };
}

// A ModelResult for a successful reply. The defaults are legal for makePerception():
// rest needs no target, the line is short and there are no tag updates.
// Override only the fields a test cares about: replyWith({ action: { type: "hunt", targetId: "t2" } })
export function replyWith(overrides: Partial<LlmResponse> = {}): ModelResult {
  return {
    kind: "reply",
    llmResponse: {
      intent: "Rest and wait.",
      action: { type: "rest" },
      tagUpdates: [],
      line: "I'll wait here.",
      ...overrides,
    },
  };
}

// A ModelResult for a failed call: failureWith("refusal")
export function failureWith(reason: ModelFailureReason): ModelResult {
  return { kind: "failure", reason };
}