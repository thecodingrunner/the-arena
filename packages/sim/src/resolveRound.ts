import {
  weaponDefinitions,
  type Action,
  type GameEvent,
  type GameState,
  type Tribute,
  type TributeId,
  type ZoneId,
} from "@arena/shared";
import { createRng, type Rng } from "./rng";

const INITIATIVE_DIE = 5;
const FORAGE_MAX_CHANCE = 0.9;
const FORAGE_BASE_CHANCE = 0.4;
const FORAGING_PER_INTELLIGENCE = 0.05;
const FORAGE_PER_BONUS = 0.05;
const FOOD_HUNGER_VALUE = 30;
const WATER_HUNGER_VALUE = 15;

type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

type EventInput = DistributiveOmit<
  GameEvent,
  "matchId" | "round" | "seq" | "v"
>;

export function resolveRound(
  state: GameState,
  actions: Record<TributeId, Action>,
): {
  state: GameState;
  events: GameEvent[];
  rngState: number;
} {
  const events = [] as GameEvent[];

  const tributes = state.tributes.map((tribute) => {
    return { ...tribute };
  });
  const zones = state.zones.map((zone) => {
    return { ...zone };
  });

  const copiedGameState = {
    ...state,
    tributes,
    zones,
    round: state.round + 1,
  };

  function emitEvent(event: EventInput) {
    events.push({
      ...event,
      matchId: copiedGameState.matchId,
      round: copiedGameState.round,
      seq: copiedGameState.seq++,
      v: 1,
    } as GameEvent);
  }

  const rng = createRng(copiedGameState.rngState);

  const orderedTributes = setInitiativeOrder(tributes, rng);

  for (const tribute of orderedTributes) {
    const action = actions[tribute.tributeId];

    if (action?.type !== "forage") continue;

    const zone = zones.find((z) => z.zoneId === tribute.position)!;

    const chance = Math.min(
      FORAGE_MAX_CHANCE,
      FORAGE_BASE_CHANCE +
        tribute.stats.intelligence * FORAGING_PER_INTELLIGENCE +
        weaponForagingBonus(tribute) * FORAGE_PER_BONUS,
    );

    const found = rng.chance(chance) && (zone.food > 0 || zone.water > 0);

    if (!found) {
      emitEvent({
        type: "TributeForaged",
        tributeId: tribute.tributeId,
        success: false,
        location: tribute.position,
      });
      continue;
    } else if (zone.food > 0) {
      zone.food--;
      const newHunger = Math.max(0, tribute.hunger - FOOD_HUNGER_VALUE);
      const delta = newHunger - tribute.hunger;
      tribute.hunger = newHunger;
      emitEvent({
        type: "TributeForaged",
        tributeId: tribute.tributeId,
        success: true,
        location: tribute.position,
      });
      emitEvent({
        type: "ZoneFoodChanged",
        zoneId: tribute.position,
        delta: -1,
        food: zone.food,
        location: tribute.position,
      });
      emitEvent({
        type: "TributeHungerChanged",
        tributeId: tribute.tributeId,
        delta: delta,
        hunger: newHunger,
        location: tribute.position,
      });
    } else {
      zone.water--;
      const newHunger = Math.max(0, tribute.hunger - WATER_HUNGER_VALUE);
      const delta = newHunger - tribute.hunger;
      tribute.hunger = newHunger;
      emitEvent({
        type: "TributeForaged",
        tributeId: tribute.tributeId,
        success: true,
        location: tribute.position,
      });
      emitEvent({
        type: "ZoneWaterChanged",
        zoneId: tribute.position,
        delta: -1,
        water: zone.water,
        location: tribute.position,
      });
      emitEvent({
        type: "TributeHungerChanged",
        tributeId: tribute.tributeId,
        delta: delta,
        hunger: newHunger,
        location: tribute.position,
      });
    }
  }

  return {
    state: copiedGameState,
    events,
    rngState: rng.getState(),
  };
}

function setInitiativeOrder(tributes: Tribute[], rng: Rng): Tribute[] {
  const initiativeArray: { tributeId: string; initiative: number }[] = [];

  const shuffledTributes = rng.shuffle(tributes);

  for (const tribute of shuffledTributes) {
    const initiative =
      rng.int(1, INITIATIVE_DIE) +
      tribute.stats.stealth +
      tribute.stats.intelligence;
    initiativeArray.push({ tributeId: tribute.tributeId, initiative });
  }

  initiativeArray.sort((a, b) => b.initiative - a.initiative);

  return initiativeArray.map((a) => {
    return tributes.find((t) => t.tributeId === a.tributeId)!;
  });
}

function weaponForagingBonus(tribute: Tribute) {
  return tribute.inventory
    .filter((i) => i.kind === "weapon")
    .reduce(
      (acc, e) =>
        acc +
        weaponDefinitions.find((w) => w.weaponDefinitionId === e.definitionId)!
          .foragingBonus,
      0,
    );
}
