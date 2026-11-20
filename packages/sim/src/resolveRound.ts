import {
  arenaDefinitions,
  HEALTH_PER_REST,
  HUNGER_HEALTH_COST,
  HUNGER_PER_MOVE_COST,
  HUNGER_TICK,
  HUNGER_VALUE,
  MAX_HP,
  MAX_HUNGER,
  weaponDefinitions,
  type Action,
  type AllianceProposalFailed,
  type GameEvent,
  type GameState,
  type PendingProposal,
  type Rng,
  type SponsorGift,
  type Tribute,
  type TributeAttacked,
  type TributeId,
  type WeaponDefinition,
  type WeaponInstance,
  type ZoneId,
} from "@arena/shared";
import { createRng } from "./rng";
import {
  AGILITY_DODGE_BONUS,
  BASE_HIT_RATE,
  CHARISMA_BETRAYAL_FORESIGHT,
  ENDURANCE_TOUGHNESS_BONUS,
  FORAGE_BASE_CHANCE,
  FORAGE_MAX_CHANCE,
  FORAGE_PER_BONUS,
  FORAGING_PER_INTELLIGENCE,
  HIDING_BONUS,
  INITIATIVE_DIE,
  MAX_HIT_CHANCE,
  MIN_DAMAGE,
  MIN_HIT_CHANCE,
  SPOTTING_DIE,
  SURPRISE_HIT_BONUS,
  WEAPON_DAMAGE_BONUS,
  WEAPON_HIT_RATE_BONUS,
} from "./rules";
import { checkMatchEnd } from "./matchEnd";
import type { Ctx, EventInput } from "./ctx";
import { resolveGifts } from "./gifts";

export function resolveRound(
  state: GameState,
  actions: Record<TributeId, Action>,
  sponsorGifts?: SponsorGift[],
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
  const withdrawn = new Set<TributeId>();

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

  const ctx = {
    zones,
    rng,
    edges,
    emitEvent,
    copiedGameState,
    pinned,
    withdrawn,
    alliancesAtStart: [...state.alliances],
  };

  const roundSponsorGifts = sponsorGifts?.filter(
    (g) => g.appliesInRound === copiedGameState.round,
  );
  if (roundSponsorGifts) {
    resolveGifts(ctx, roundSponsorGifts);
  }

  const orderedTributes = setInitiativeOrder(tributes, rng);

  for (const proposal of copiedGameState.pendingProposals) {
    const action = actions[proposal.proposerId];
    if (action?.type === "hunt" && action.targetId === proposal.targetId) {
      withdrawn.add(proposal.proposalId);
    }
  }

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
      case "accept_alliance":
        resolveAcceptAlliance(ctx, tribute, action.proposerId);
        break;
      case "propose_alliance":
        resolveProposeAlliance(ctx, tribute, action.tributeId);
        break;
      case "betray":
        resolveBetray(ctx, tribute, action.allyId);
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

  // Remove ignored proposals

  for (const proposal of copiedGameState.pendingProposals) {
    if (proposal.round < copiedGameState.round) {
      failProposal(
        ctx,
        proposal,
        "ignored",
        tributes.find((t) => t.tributeId === proposal.targetId)!.position,
      );
    }
  }
  copiedGameState.pendingProposals = copiedGameState.pendingProposals.filter(
    (p) => p.round === copiedGameState.round,
  );

  for (const tribute of tributes) {
    if (tribute.alive === false) {
      copiedGameState.alliances = copiedGameState.alliances.filter(
        (a) => !a.memberIds.includes(tribute.tributeId),
      );
    }
  }

  const matchEnd = checkMatchEnd(copiedGameState.round, startHp, tributes, rng);

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
  const { emitEvent, copiedGameState, rng, pinned, withdrawn } = ctx;

  if (
    copiedGameState.alliances.some(
      (a) =>
        a.memberIds.includes(tribute.tributeId) &&
        a.memberIds.includes(targetTributeId),
    )
  ) {
    throw new Error("Tributes cannot hunt an ally");
  }

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

  if (
    copiedGameState.pendingProposals.some(
      (p) => p.proposerId === tribute.tributeId,
    )
  ) {
    withdrawn.add(tribute.tributeId);
  }

  if (
    targetTribute.alive === false ||
    targetTribute.position !== tribute.position
  ) {
    emitAttack("targetGone", null);
    return;
  }

  resolveAttack(ctx, tribute, targetTribute, {});
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

function resolveAcceptAlliance(
  ctx: Ctx,
  tribute: Tribute,
  proposerTributeId: TributeId,
) {
  const { copiedGameState, emitEvent, withdrawn } = ctx;

  const proposal = copiedGameState.pendingProposals.find(
    (p) =>
      p.proposerId === proposerTributeId && p.targetId === tribute.tributeId,
  );

  if (proposal === undefined) {
    throw new Error("Tributes cannot accept an alliance without a proposal");
  }

  if (withdrawn.has(proposal.proposalId)) {
    failProposal(ctx, proposal, "withdrawn", tribute.position);
    return;
  }

  const proposerTribute = copiedGameState.tributes.find(
    (t) => t.tributeId === proposerTributeId,
  );

  if (proposerTribute === undefined) {
    throw new Error(
      `proposerTribute ${proposerTributeId} does not exist, so tribute ${tribute.tributeId} cannot accept an alliance`,
    );
  }

  if (proposerTribute.alive === false) {
    failProposal(ctx, proposal, "proposerGone", tribute.position);
    return;
  }

  if (proposerTribute.position !== tribute.position) {
    failProposal(ctx, proposal, "proposerGone", tribute.position);
    copiedGameState.pendingProposals = copiedGameState.pendingProposals.filter(
      (p) => p.proposalId !== proposal.proposalId,
    );
    return;
  }

  if (
    copiedGameState.alliances.some((a) =>
      a.memberIds.includes(proposerTributeId),
    )
  ) {
    failProposal(ctx, proposal, "proposerAllied", tribute.position);
    copiedGameState.pendingProposals = copiedGameState.pendingProposals.filter(
      (p) => p.proposalId !== proposal.proposalId,
    );
    return;
  }

  const allianceId = allianceIdFor(
    copiedGameState.round,
    proposerTributeId,
    tribute.tributeId,
  );

  emitEvent({
    type: "AllianceFormed",
    allianceId: allianceId,
    memberIds: [proposerTributeId, tribute.tributeId],
    location: tribute.position,
  });
  copiedGameState.alliances.push({
    allianceId: allianceId,
    memberIds: [proposerTributeId, tribute.tributeId],
  });
  copiedGameState.pendingProposals = copiedGameState.pendingProposals.filter(
    (p) => p.proposalId !== proposal.proposalId,
  );
}

function resolveBetray(ctx: Ctx, tribute: Tribute, allyTributeId: TributeId) {
  const { copiedGameState, emitEvent, alliancesAtStart } = ctx;

  const allyTribute = copiedGameState.tributes.find(
    (t) => t.tributeId === allyTributeId,
  );

  if (allyTribute === undefined) {
    throw new Error(
      `allyTribute ${allyTributeId} does not exist, so tribute ${tribute.tributeId} cannot betray`,
    );
  }

  const alliance = copiedGameState.alliances.find(
    (a) =>
      a.memberIds.includes(tribute.tributeId) &&
      a.memberIds.includes(allyTributeId),
  );

  if (alliance) {
    if (allyTribute.position !== tribute.position) {
      emitEvent({
        type: "AllianceBetrayed",
        betrayerId: tribute.tributeId,
        victimId: allyTributeId,
        allianceId: alliance.allianceId,
        outcome: "targetGone",
        location: tribute.position,
      });
      return;
    }

    emitEvent({
      type: "AllianceBetrayed",
      betrayerId: tribute.tributeId,
      victimId: allyTributeId,
      allianceId: alliance.allianceId,
      outcome: "success",
      location: tribute.position,
    });

    copiedGameState.alliances = copiedGameState.alliances.filter(
      (a) => a.allianceId !== alliance.allianceId,
    );

    resolveAttack(ctx, tribute, allyTribute, {
      hitBonus: surpriseBonus(allyTribute.stats.charisma),
      pinOnHit: true,
    });
  } else if (
    alliancesAtStart.some(
      (a) =>
        a.memberIds.includes(tribute.tributeId) &&
        a.memberIds.includes(allyTributeId),
    )
  ) {
    resolveAttack(ctx, tribute, allyTribute, {
      hitBonus: surpriseBonus(allyTribute.stats.charisma),
      pinOnHit: true,
    });
  } else {
    throw new Error("A tribute cannot betray an alliance that doesn't exist");
  }
}

function resolveProposeAlliance(
  ctx: Ctx,
  tribute: Tribute,
  targetTributeId: TributeId,
) {
  const { copiedGameState, emitEvent } = ctx;

  const targetTribute = copiedGameState.tributes.find(
    (t) => t.tributeId === targetTributeId,
  );

  if (targetTribute === undefined) {
    throw new Error(
      `targetTribute ${targetTributeId} does not exist, so tribute ${tribute.tributeId} cannot propose an alliance`,
    );
  }

  const proposalId = proposalIdFor(
    copiedGameState.round,
    tribute.tributeId,
    targetTributeId,
  );

  if (
    copiedGameState.alliances.some((a) => a.memberIds.includes(targetTributeId))
  ) {
    emitEvent({
      type: "AllianceProposalFailed",
      proposerId: tribute.tributeId,
      targetId: targetTributeId,
      location: tribute.position,
      proposalId: proposalId,
      reason: "targetAllied",
    });
  }

  if (tribute.position !== targetTribute.position) {
    emitEvent({
      type: "AllianceProposalFailed",
      proposerId: tribute.tributeId,
      targetId: targetTributeId,
      proposalId: proposalId,
      reason: "targetGone",
      location: tribute.position,
    });
    return;
  }

  const mutualProposal = copiedGameState.pendingProposals.find(
    (p) =>
      p.round === copiedGameState.round &&
      p.proposerId === targetTributeId &&
      p.targetId === tribute.tributeId,
  );

  if (mutualProposal !== undefined) {
    const allianceId = allianceIdFor(
      copiedGameState.round,
      mutualProposal.proposerId,
      mutualProposal.targetId,
    );
    emitEvent({
      type: "AllianceFormed",
      memberIds: [mutualProposal.proposerId, mutualProposal.targetId],
      allianceId: allianceId,
      location: targetTribute.position,
    });
    copiedGameState.alliances.push({
      allianceId: allianceId,
      memberIds: [mutualProposal.proposerId, mutualProposal.targetId],
    });
    copiedGameState.pendingProposals = copiedGameState.pendingProposals.filter(
      (p) => p.proposalId !== mutualProposal.proposalId,
    );
    return;
  }

  copiedGameState.pendingProposals.push({
    proposalId: proposalId,
    proposerId: tribute.tributeId,
    targetId: targetTributeId,
    round: copiedGameState.round,
  });

  emitEvent({
    type: "AllianceProposed",
    proposerId: tribute.tributeId,
    targetId: targetTributeId,
    proposalId: proposalId,
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
  bonus = 0,
): number {
  const hitChance =
    BASE_HIT_RATE +
    attacker.stats[weaponDefinition.scalesWith] * WEAPON_HIT_RATE_BONUS -
    victim.stats.agility * AGILITY_DODGE_BONUS +
    bonus;

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

export function allianceIdFor(
  round: number,
  proposerId: TributeId,
  targetId: TributeId,
) {
  return `a-${round}-${proposerId}-${targetId}`;
}

export function proposalIdFor(
  round: number,
  proposerId: TributeId,
  targetId: TributeId,
) {
  return `p-${round}-${proposerId}-${targetId}`;
}

function resolveAttack(
  ctx: Ctx,
  attacker: Tribute,
  target: Tribute,
  { hitBonus = 0, pinOnHit = false },
) {
  const { emitEvent, rng, pinned } = ctx;

  function emitAttack(
    outcome: TributeAttacked["outcome"],
    weaponDefinitionId: TributeAttacked["weaponDefinitionId"],
  ) {
    emitEvent({
      type: "TributeAttacked",
      attackerId: attacker.tributeId,
      victimId: target.tributeId,
      outcome,
      location: attacker.position,
      weaponDefinitionId,
    });
  }

  if (pinned.has(attacker.tributeId)) {
    emitAttack("pinnedDown", null);
    return;
  }

  if (target.hiding === true) {
    const spotted =
      target.stats.stealth * HIDING_BONUS + rng.int(1, SPOTTING_DIE) <=
      attacker.stats.intelligence + rng.int(1, SPOTTING_DIE);

    if (!spotted) {
      emitAttack("notFound", null);
      return;
    }
  }

  const { instance: weaponInstance, definition: weaponDefinition } =
    chooseWeapon(attacker);

  const hit = rng.chance(
    hitChance(attacker, target, weaponDefinition, hitBonus),
  );

  emitAttack(hit ? "hit" : "missed", weaponDefinition.weaponDefinitionId);

  if (weaponInstance && weaponInstance.ammunition !== null) {
    weaponInstance.ammunition--;

    emitEvent({
      type: "TributeAmmunitionChanged",
      tributeId: attacker.tributeId,
      itemId: weaponInstance.itemId,
      delta: -1,
      ammunition: weaponInstance.ammunition,
      location: attacker.position,
    });
  }

  if (hit) {
    const damageDone = damage(attacker, target, weaponDefinition);

    const newHealth = Math.max(0, target.hp - damageDone);
    const delta = newHealth - target.hp;
    target.hp = newHealth;

    emitEvent({
      type: "TributeHealthChanged",
      tributeId: target.tributeId,
      delta: delta,
      hp: newHealth,
      location: target.position,
    });

    if (target.hp === 0) {
      target.alive = false;
      target.diedInRound = ctx.copiedGameState.round;
      attacker.kills++;

      emitEvent({
        type: "TributeDied",
        victimId: target.tributeId,
        cause: {
          kind: "attack",
          killerId: attacker.tributeId,
        },
        location: target.position,
      });

      const victimWeapons = target.inventory.filter((i) => i.kind === "weapon");

      attacker.inventory = [...attacker.inventory, ...victimWeapons];
      target.inventory = [];

      for (const weapon of victimWeapons) {
        emitEvent({
          type: "TributeGainedItem",
          tributeId: attacker.tributeId,
          item: weapon,
          location: attacker.position,
        });
      }
    }
    if (weaponDefinition.ranged || pinOnHit) {
      pinned.add(target.tributeId);
    }
  }
}

export function surpriseBonus(charisma: number) {
  return Math.min(
    0,
    SURPRISE_HIT_BONUS - charisma * CHARISMA_BETRAYAL_FORESIGHT,
  );
}

const failProposal = (
  ctx: Ctx,
  proposal: PendingProposal,
  reason: AllianceProposalFailed["reason"],
  location: ZoneId,
) => {
  const { emitEvent, copiedGameState } = ctx;

  emitEvent({
    type: "AllianceProposalFailed",
    proposalId: proposal.proposalId,
    proposerId: proposal.proposerId,
    targetId: proposal.targetId,
    reason,
    location: location,
  });
  copiedGameState.pendingProposals = copiedGameState.pendingProposals.filter(
    (p) => p.proposalId !== proposal.proposalId,
  );
};
