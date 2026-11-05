import {
  arenaDefinitions,
  weaponDefinitions,
  type Action,
  type ArenaDefinition,
  type GameEvent,
  type GameState,
  type Tribute,
  type TributeId,
  type Zone,
} from "@arena/shared";
import { createRng, type Rng } from "./rng";
import { FORAGE_BASE_CHANCE, FORAGE_MAX_CHANCE, FORAGE_PER_BONUS, FORAGING_PER_INTELLIGENCE, HEALTH_PER_REST, HUNGER_HEALTH_COST, HUNGER_PER_MOVE_COST, HUNGER_TICK, HUNGER_VALUE, INITIATIVE_DIE, MAX_HP, MAX_HUNGER } from "./rules";

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

  const arena = arenaDefinitions.find(
    (a) => a.arenaId === copiedGameState.arenaId,
  )!; // safe because createMatch already validated arenaId

  const edges = arena.edges;

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

  const ctx = {
    zones,
    rng,
    edges,
    emitEvent,
  };

  for (const tribute of orderedTributes) {
    if (tribute.alive === false) continue;

    const action = actions[tribute.tributeId];

    if (!action) throw new Error(`no action for tribute ${tribute.tributeId}`);

    switch (action.type) {
      case "forage":
        resolveForage(ctx, tribute);
        break;
      case "rest":
        resolveRest(ctx, tribute);
        break;
      case "move_to":
        resolveMoveTo(ctx, tribute, action.zoneId);
        break;
      case "hide":
      case "hunt":
      case "betray":
      case "propose_alliance":
      case "accept_alliance":
      case "use_item":
        break;
      default: {
        const unreachable: never = action; // compile error if a new Action type is added without a case
        throw new Error(`unhandled action ${JSON.stringify(unreachable)}`);
      }
    }
  }

  for (const tribute of tributes) {
    if (tribute.alive === false) continue;
    // Hunger tick

    const newHunger = Math.min(MAX_HUNGER, tribute.hunger + (HUNGER_TICK - Math.floor(tribute.stats.endurance / 4)));
    const delta = newHunger - tribute.hunger;
    tribute.hunger = newHunger;

    emitEvent({
      type: "TributeHungerChanged",
      tributeId: tribute.tributeId,
      delta: delta,
      hunger: tribute.hunger,
      location: tribute.position,
    });

    if (tribute.hunger >= MAX_HUNGER) {
      const newHealth = Math.max(0, tribute.hp - HUNGER_HEALTH_COST);
      const delta = newHealth - tribute.hp;
      tribute.hp = newHealth;

      emitEvent({
        type: "TributeHealthChanged",
        tributeId: tribute.tributeId,
        delta: delta,
        hp: newHealth,
        location: tribute.position,
      });
      if (tribute.hp <= 0) {
        tribute.alive = false;

        emitEvent({
          type: "TributeDied",
          cause: { kind: "hunger" },
          victimId: tribute.tributeId,
          location: tribute.position,
        });
      }
    }
  }

  copiedGameState.rngState = rng.getState();

  return {
    state: copiedGameState,
    events,
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

function feed(
  tribute: Tribute,
  value: number,
): { hunger: number; delta: number } {
  const hunger = Math.max(0, tribute.hunger - value);
  const delta = hunger - tribute.hunger;

  return { hunger, delta };
}

type Ctx = {
  zones: Zone[];
  rng: Rng;
  edges?: ArenaDefinition["edges"];
  emitEvent: (e: EventInput) => void;
};

function resolveForage(ctx: Ctx, tribute: Tribute) {
  const { zones, rng, emitEvent } = ctx;

  const zone = zones.find((z) => z.zoneId === tribute.position)!; // safe because a tribute's position always comes from a real zone

  const chance = Math.min(
    FORAGE_MAX_CHANCE,
    FORAGE_BASE_CHANCE +
      tribute.stats.intelligence * FORAGING_PER_INTELLIGENCE +
      weaponForagingBonus(tribute) * FORAGE_PER_BONUS,
  );

  const found = rng.chance(chance) && (zone.food > 0 || zone.water > 0);
  const resource = zone.food > 0 ? "food" : "water";

  if (!found) {
    emitEvent({
      type: "TributeForaged",
      tributeId: tribute.tributeId,
      success: false,
      location: tribute.position,
    });
  } else {
    zone[resource]--;
    const { hunger, delta } = feed(tribute, HUNGER_VALUE[resource]);
    tribute.hunger = hunger;

    if (resource === "food") {
      emitEvent({
        type: "ZoneFoodChanged",
        zoneId: tribute.position,
        delta: -1,
        food: zone.food,
        location: tribute.position,
      });
    } else {
      emitEvent({
        type: "ZoneWaterChanged",
        zoneId: tribute.position,
        delta: -1,
        water: zone.water,
        location: tribute.position,
      });
    }

    emitEvent({
      type: "TributeForaged",
      tributeId: tribute.tributeId,
      success: true,
      location: tribute.position,
    });
    emitEvent({
      type: "TributeHungerChanged",
      tributeId: tribute.tributeId,
      delta: delta,
      hunger: hunger,
      location: tribute.position,
    });
  }
}

function resolveRest(ctx: Ctx, tribute: Tribute) {
  const { emitEvent } = ctx;

  const newHealth = Math.min(tribute.hp + HEALTH_PER_REST, MAX_HP);
  const delta = newHealth - tribute.hp;
  tribute.hp = newHealth;
  emitEvent({
    type: "TributeRested",
    tributeId: tribute.tributeId,
    location: tribute.position,
  });
  emitEvent({
    type: "TributeHealthChanged",
    tributeId: tribute.tributeId,
    delta: delta,
    hp: newHealth,
    location: tribute.position,
  });
}

function resolveMoveTo(ctx: Ctx, tribute: Tribute, targetZoneId: string) {
  const { edges, zones, emitEvent } = ctx;

  const previousZone = zones.find((z) => z.zoneId === tribute.position)!;
  const currentZone = zones.find((z) => z.zoneId === targetZoneId);

  if (!currentZone)
    throw new Error(
      `${targetZoneId} does not exist, so tribute ${tribute.tributeId} cannot move there`,
    );

  const edge = edges?.find(
    (e) => e.from === previousZone.zoneId && e.to === currentZone.zoneId,
  );

  if (!edge)
    throw new Error(
      `${tribute.tributeId} can not move from ${previousZone.zoneId} to ${currentZone.zoneId} because there is no edge`,
    );

  const moveCost = edge.cost;

  const newHunger = Math.min(
    MAX_HUNGER,
    tribute.hunger + moveCost * HUNGER_PER_MOVE_COST,
  );
  const delta = newHunger - tribute.hunger;
  tribute.hunger = newHunger;

  tribute.position = currentZone.zoneId;
  emitEvent({
    type: "TributeChangedZone",
    tributeId: tribute.tributeId,
    previousZoneId: previousZone.zoneId,
    currentZoneId: currentZone.zoneId,
    location: previousZone.zoneId,
  });
  emitEvent({
    type: "TributeHungerChanged",
    tributeId: tribute.tributeId,
    delta: delta,
    hunger: newHunger,
    location: previousZone.zoneId,
  });
}
