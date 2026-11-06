import {
  arenaDefinitions,
  weaponDefinitions,
  type Action,
  type ArenaDefinition,
  type GameEvent,
  type GameState,
  type Tribute,
  type TributeId,
  type WeaponInstance,
  type Zone,
} from "@arena/shared";
import { createRng, type Rng } from "./rng";
import {
  AGILITY_DODGE_BONUS,
  BASE_HIT_RATE,
  FORAGE_BASE_CHANCE,
  FORAGE_MAX_CHANCE,
  FORAGE_PER_BONUS,
  FORAGING_PER_INTELLIGENCE,
  HEALTH_PER_REST,
  HIDING_BONUS,
  HUNGER_HEALTH_COST,
  HUNGER_PER_MOVE_COST,
  HUNGER_TICK,
  HUNGER_VALUE,
  INITIATIVE_DIE,
  MAX_HP,
  MAX_HUNGER,
  SPOTTING_DIE,
  WEAPON_DAMAGE_BONUS,
  WEAPON_HIT_RATE_BONUS,
} from "./rules";

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
    return {
      ...tribute,
      inventory: tribute.inventory.map((i) => ({ ...i })),
      hiding: false,
    };
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

  const pinned = new Set<TributeId>();

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
    copiedGameState,
    pinned,
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
      case "hunt":
        resolveHunt(ctx, tribute, action.targetId);
        break;
      case "hide":
        resolveHide(ctx, tribute);
        break;
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

    const newHunger = Math.min(
      MAX_HUNGER,
      tribute.hunger + (HUNGER_TICK - Math.floor(tribute.stats.endurance / 4)),
    );
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
  edges: ArenaDefinition["edges"];
  emitEvent: (e: EventInput) => void;
  copiedGameState: GameState;
  pinned: Set<string>;
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

function resolveHunt(ctx: Ctx, tribute: Tribute, targetTributeId: string) {
  const { emitEvent, copiedGameState, rng, pinned } = ctx;

  const targetTribute = copiedGameState.tributes.find(
    (t) => t.tributeId === targetTributeId,
  );

  if (pinned.has(tribute.tributeId)) {
    emitEvent({
      type: "TributeAttacked",
      attackerId: tribute.tributeId,
      victimId: targetTributeId,
      outcome: "pinnedDown",
      location: tribute.position,
      weaponDefinitionId: "",
    });
    return;
  }

  if (targetTribute === undefined) {
    throw new Error(
      `targetTribute ${targetTributeId} does not exist, so tribute ${tribute.tributeId} cannot attack it`,
    );
  }

  if (
    targetTribute.alive === false ||
    targetTribute.position !== tribute.position
  ) {
    emitEvent({
      type: "TributeAttacked",
      attackerId: tribute.tributeId,
      victimId: targetTributeId,
      outcome: "targetGone",
      location: tribute.position,
      weaponDefinitionId: "",
    });
    return;
  }

  if (targetTribute.hiding === true) {
    const spotted =
      targetTribute.stats.stealth * HIDING_BONUS + rng.int(1, SPOTTING_DIE) <=
      tribute.stats.intelligence + rng.int(1, SPOTTING_DIE);

    if (!spotted) {
      emitEvent({
        type: "TributeAttacked",
        attackerId: tribute.tributeId,
        victimId: targetTributeId,
        outcome: "notFound",
        location: tribute.position,
        weaponDefinitionId: "",
      });
      return;
    }
  }

  const weaponId = chooseWeapon(tribute);
  const weaponInstance = tribute.inventory.find(
    (i) => i.definitionId === weaponId,
  ) as WeaponInstance | undefined;

  const hit = rng.chance(hitChance(tribute, targetTribute, weaponId));

  if (hit) {
    emitEvent({
      type: "TributeAttacked",
      attackerId: tribute.tributeId,
      victimId: targetTributeId,
      outcome: "hit",
      location: tribute.position,
      weaponDefinitionId: weaponId,
    });
    if (
      weaponDefinitions.find((d) => d.weaponDefinitionId === weaponId)?.ranged
    ) {
      pinned.add(targetTributeId);
    }
  } else {
    emitEvent({
      type: "TributeAttacked",
      attackerId: tribute.tributeId,
      victimId: targetTributeId,
      outcome: "missed",
      location: tribute.position,
      weaponDefinitionId: weaponId,
    });
  }

  if (weaponInstance && weaponInstance.ammunition !== null) {
    if (weaponInstance && weaponInstance.ammunition !== null)
      weaponInstance.ammunition--;

    emitEvent({
      type: "TributeAmmunitionChanged",
      tributeId: tribute.tributeId,
      itemId: weaponInstance.itemId,
      delta: -1,
      ammunition: weaponInstance.ammunition,
      location: tribute.position,
    });
  }
}

function resolveHide(ctx: Ctx, tribute: Tribute) {
  const { emitEvent } = ctx;
  tribute.hiding = true;
  emitEvent({
    type: "TributeHid",
    tributeId: tribute.tributeId,
    location: tribute.position,
  });
}

function chooseWeapon(tribute: Tribute): string {
  const weapons = tribute.inventory.filter(
    (i) => i.kind === "weapon" && i.ammunition !== 0,
  ) as WeaponInstance[];

  weapons.sort((i1, i2) => {
    const i1Definition = weaponDefinitions.find(
      (d) => d.weaponDefinitionId === i1.definitionId,
    )!;
    const i2Definition = weaponDefinitions.find(
      (d) => d.weaponDefinitionId === i2.definitionId,
    )!;
    const i1Damage =
      i1Definition.power +
      tribute.stats[i1Definition.scalesWith] * WEAPON_DAMAGE_BONUS;
    const i2Damage =
      i2Definition.power +
      tribute.stats[i2Definition.scalesWith] * WEAPON_DAMAGE_BONUS;

    return i2Damage - i1Damage;
  });

  return weapons[0]?.definitionId ?? "unarmed";
}

function hitChance(
  attacker: Tribute,
  victim: Tribute,
  weaponId: string,
): number {
  const weaponDefinition = weaponDefinitions.find(
    (d) => d.weaponDefinitionId === weaponId,
  )!;
  const hitChance =
    BASE_HIT_RATE +
    (attacker.stats[weaponDefinition.scalesWith] ?? 0) * WEAPON_HIT_RATE_BONUS -
    (victim.stats.agility ?? 0) * AGILITY_DODGE_BONUS;
  return hitChance;
}
