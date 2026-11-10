import {
  arenaDefinitions,
  weaponDefinitions,
  type Action,
  type ArenaDefinition,
  type GameEvent,
  type GameState,
  type Rng,
  type Tribute,
  type TributeAttacked,
  type TributeId,
  type WeaponDefinition,
  type WeaponInstance,
  type Zone,
} from "@arena/shared";
import { createRng } from "./rng";
import {
  AGILITY_DODGE_BONUS,
  BASE_HIT_RATE,
  ENDURANCE_TOUGHNESS_BONUS,
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
  MAX_HIT_CHANCE,
  MAX_HP,
  MAX_HUNGER,
  MIN_DAMAGE,
  MIN_HIT_CHANCE,
  SPOTTING_DIE,
  WEAPON_DAMAGE_BONUS,
  WEAPON_HIT_RATE_BONUS,
} from "./rules";
import { checkMatchEnd } from "./matchEnd";

type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

type EventInput = DistributiveOmit<
  GameEvent,
  "matchId" | "round" | "seq" | "v"
>;

type Ctx = {
  zones: Zone[];
  rng: Rng;
  edges: ArenaDefinition["edges"];
  emitEvent: (e: EventInput) => void;
  copiedGameState: GameState;
  pinned: Set<string>;
};

export function resolveRound(
  state: GameState,
  actions: Record<TributeId, Action>,
): {
  state: GameState;
  events: GameEvent[];
} {
  if (state.result !== null) throw new Error("The match has already ended");

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
        tribute.diedInRound = copiedGameState.round;

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

  const startHp = copiedGameState.tributes.reduce(
    (acc, t) => ({ ...acc, [t.tributeId]: t.hp }),
    {} as Record<TributeId, number>,
  );

  const matchEnd = checkMatchEnd(
    copiedGameState.round,
    startHp,
    tributes,
    rng,
  );

  if (matchEnd) {
    emitEvent({
      type: "MatchEnded",
      result: matchEnd,
      location: "arena",
    });
    copiedGameState.result = matchEnd;
  }

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

  function emitAttack(
    outcome: TributeAttacked["outcome"],
    weaponDefinitionId: TributeAttacked["weaponDefinitionId"],
  ) {
    emitEvent({
      type: "TributeAttacked",
      attackerId: tribute.tributeId,
      victimId: targetTributeId,
      outcome,
      location: tribute.position,
      weaponDefinitionId,
    });
  }

  const targetTribute = copiedGameState.tributes.find(
    (t) => t.tributeId === targetTributeId,
  );

  if (targetTribute === undefined) {
    throw new Error(
      `targetTribute ${targetTributeId} does not exist, so tribute ${tribute.tributeId} cannot attack it`,
    );
  }

  if (targetTribute.tributeId === tribute.tributeId) {
    throw new Error("a tribute can't hunt themself");
  }

  if (pinned.has(tribute.tributeId)) {
    emitAttack("pinnedDown", null);
    return;
  }

  if (
    targetTribute.alive === false ||
    targetTribute.position !== tribute.position
  ) {
    emitAttack("targetGone", null);
    return;
  }

  if (targetTribute.hiding === true) {
    const spotted =
      targetTribute.stats.stealth * HIDING_BONUS + rng.int(1, SPOTTING_DIE) <=
      tribute.stats.intelligence + rng.int(1, SPOTTING_DIE);

    if (!spotted) {
      emitAttack("notFound", null);
      return;
    }
  }

  const { instance: weaponInstance, definition: weaponDefinition } =
    chooseWeapon(tribute);

  const hit = rng.chance(hitChance(tribute, targetTribute, weaponDefinition));

  emitAttack(hit ? "hit" : "missed", weaponDefinition.weaponDefinitionId);

  if (weaponInstance && weaponInstance.ammunition !== null) {
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

  if (hit) {
    const damageDone = damage(tribute, targetTribute, weaponDefinition);

    const newHealth = Math.max(0, targetTribute.hp - damageDone);
    const delta = newHealth - targetTribute.hp;
    targetTribute.hp = newHealth;

    emitEvent({
      type: "TributeHealthChanged",
      tributeId: targetTributeId,
      delta: delta,
      hp: newHealth,
      location: targetTribute.position,
    });

    if (targetTribute.hp === 0) {
      targetTribute.alive = false;
      targetTribute.diedInRound = ctx.copiedGameState.round;
      tribute.kills++;

      emitEvent({
        type: "TributeDied",
        victimId: targetTributeId,
        cause: {
          kind: "attack",
          killerId: tribute.tributeId,
        },
        location: targetTribute.position,
      });

      const victimWeapons = targetTribute.inventory.filter(
        (i) => i.kind === "weapon",
      );

      tribute.inventory = [...tribute.inventory, ...victimWeapons];
      targetTribute.inventory = [];

      for (const weapon of victimWeapons) {
        emitEvent({
          type: "TributeGainedItem",
          tributeId: tribute.tributeId,
          item: weapon,
          location: tribute.position,
        });
      }
    }
    if (weaponDefinition.ranged) {
      pinned.add(targetTributeId);
    }
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

function chooseWeapon(tribute: Tribute): {
  instance: WeaponInstance | null;
  definition: WeaponDefinition;
} {
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

  const weaponInstance = weapons[0];

  if (!weaponInstance) {
    return {
      instance: null,
      definition: weaponDefinitions.find(
        (d) => d.weaponDefinitionId === "unarmed",
      )!,
    };
  }

  const weaponDefinition = weaponDefinitions.find(
    (d) => d.weaponDefinitionId === weaponInstance.definitionId,
  )!;

  return { instance: weaponInstance, definition: weaponDefinition };
}

export function hitChance(
  attacker: Tribute,
  victim: Tribute,
  weaponDefinition: WeaponDefinition,
): number {
  const hitChance =
    BASE_HIT_RATE +
    attacker.stats[weaponDefinition.scalesWith] * WEAPON_HIT_RATE_BONUS -
    victim.stats.agility * AGILITY_DODGE_BONUS;

  if (hitChance < MIN_HIT_CHANCE) {
    return MIN_HIT_CHANCE;
  }

  if (hitChance > MAX_HIT_CHANCE) {
    return MAX_HIT_CHANCE;
  }

  return hitChance;
}

export function damage(
  attacker: Tribute,
  victim: Tribute,
  weaponDefinition: WeaponDefinition,
): number {
  // damage = weapon.power + attacker.stats[weapon.scalesWith] × SCALE_BONUS
  // - (victim.stats.endurance * 0.5) (clamped e.g. 1)

  const damage =
    weaponDefinition.power +
    attacker.stats[weaponDefinition.scalesWith] * WEAPON_DAMAGE_BONUS -
    Math.floor(victim.stats.endurance * ENDURANCE_TOUGHNESS_BONUS);

  if (damage < MIN_DAMAGE) {
    return MIN_DAMAGE;
  }

  return damage;
}
