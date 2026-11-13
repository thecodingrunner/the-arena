// observer = starting position from initialState, alive
// for each event in seq order:
//     decide whether observer sees it   (canSee + the classification rules)
//     if it's a TributeChangedZone for observer → update position
//     if it's a TributeDied for observer        → alive = false

import {
  weaponDefinitions,
  type GameEvent,
  type GameState,
  type TributeAttacked,
  type TributeId,
} from "@arena/shared";
import { canSee } from "./visibility";

export type UnseenAttack = Omit<TributeAttacked, "attackerId"> & {
  attackerId: null;
};
export type WitnessedEvent = GameEvent | UnseenAttack;

const publicEvents: GameEvent["type"][] = [
  "TributeAttacked",
  "TributeDied",
  "TributeForaged",
  "TributeRested",
  "TributeGainedItem",
  "TributeBetrayedAlliance",
  "TributeChangedZone",
  "ZoneWaterChanged",
  "ZoneFoodChanged",
  "ZoneFlooded",
  "ZoneClosed",
];

export function witnessed(
  initialState: GameState,
  events: GameEvent[],
  tributeId: TributeId,
): WitnessedEvent[] {
  const observer = initialState.tributes.find((t) => t.tributeId === tributeId);

  if (!observer)
    throw new Error(`tribute ${tributeId} is not in state.tributes`);

  let position = observer.position;

  let alive = observer.alive;

  const witnessedEvents: WitnessedEvent[] = [];

  for (const e of events) {
    const canSeeEvent = canSee({ position, alive }, e.location);

    if (e.type === "TributeChangedZone" && e.tributeId === tributeId) {
      position = e.currentZoneId;
    } else if (e.type === "TributeDied" && e.victimId === tributeId) {
      alive = false;
    }

    const publicEvent = publicEvents.includes(e.type);
    const isOwnEvent = isOwn(e, tributeId);

    const included = isOwnEvent || (canSeeEvent && publicEvent);

    if (!included) continue;

    if (e.type === "TributeAttacked" && e.victimId === tributeId) {
      const notRegistered =
        e.outcome === "notFound" || e.outcome === "targetGone";
      if (notRegistered) continue;

      if (isRanged(e.weaponDefinitionId)) {
        witnessedEvents.push({ ...e, attackerId: null } as UnseenAttack);
        continue;
      }
    }

    witnessedEvents.push(e);
  }

  return witnessedEvents;
}

function isOwn(e: GameEvent, tributeId: TributeId): boolean {
  switch (e.type) {
    case "TributeHid":
    case "TributeRested":
    case "TributeHealthChanged":
    case "TributeAmmunitionChanged":
    case "TributeHungerChanged":
    case "TributeForaged":
    case "TributeGainedItem":
    case "TributeChangedZone":
      return e.tributeId === tributeId;
    case "TributeDied":
      return e.victimId === tributeId;
    case "TributeAttacked":
      return e.attackerId === tributeId || e.victimId === tributeId;
    case "SponsorGiftUndelivered":
    case "SponsorGiftDelivered":
      return e.to === tributeId;
    case "TributeBetrayedAlliance":
      // TODO: currently only includes the betrayer, will need to add the alliance members in stage 10
      return e.betrayerId === tributeId;
    case "ZoneWaterChanged":
    case "ZoneFoodChanged":
    case "MatchEnded":
    case "ZoneFlooded":
    case "ZoneClosed":
      return false;
    default: {
      const unhandled: never = e; // compile error if a case is missing
      return unhandled;
    }
  }
}

function isRanged(weaponDefinitionId: string | null): boolean {
  const weapon = weaponDefinitions.find(
    (w) => w.weaponDefinitionId === weaponDefinitionId,
  );

  if (weaponDefinitionId === null) return false;
  if (weapon === undefined) throw new Error(`unknown weaponDefinitionId ${weaponDefinitionId}`);

  return weapon.ranged;
}
