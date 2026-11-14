import type { Facts, TributeId } from "@arena/shared";
import type { WitnessedEvent } from "./witnessed";

export function buildFacts(
  witnessedEvents: WitnessedEvent[],
  observerId: TributeId,
): Record<TributeId, Facts> {
  const facts: Record<TributeId, Facts> = {};

  function entry(id: TributeId | null, e: WitnessedEvent): Facts | undefined {
    if (id === null || id === observerId) return undefined;
    const f = (facts[id] ??= {
      lastSeen: { position: e.location, round: e.round },
    });
    delete f.heading;
    f.lastSeen = { position: e.location, round: e.round };
    return f;
  }

  function addUnique<T>(list: T[] | undefined, item: T): T[] {
    const current = list ?? [];
    return current.includes(item) ? current : current.concat(item);
  }

  for (const e of witnessedEvents) {
    switch (e.type) {
      case "TributeAttacked": {
        if (e.attackerId === observerId) {
          const victim = entry(e.victimId, e);
          if (victim) {
            victim.youAttacked = (victim.youAttacked ?? 0) + 1;
            victim.youLastAttacked = e.round;
          }
        }
        if (e.victimId === observerId) {
          const attacker = entry(e.attackerId, e);
          if (attacker) {
            attacker.attackedYou = (attacker.attackedYou ?? 0) + 1;
            attacker.lastAttackedYou = e.round;
          }
        }
        const attacker = entry(e.attackerId, e);
        if (attacker) {
          if (e.victimId !== observerId) {
            attacker.attacked = addUnique(attacker.attacked, e.victimId);
          }

          if (e.weaponDefinitionId !== null) {
            attacker.weaponsSeen = addUnique(
              attacker.weaponsSeen,
              e.weaponDefinitionId,
            );
          }
        }
        break;
      }
      case "TributeDied": {
        const victim = entry(e.victimId, e);
        if (victim) {
          victim.diedRound = e.round;
        }
        if (e.cause.kind === "attack") {
          const killer = entry(e.cause.killerId, e);
          if (killer) {
            killer.killed = (killer.killed ?? []).concat(e.victimId);
          }
        }
        break;
      }
      case "SponsorGiftDelivered":
      case "SponsorGiftUndelivered": {
        entry(e.to, e);
        break;
      }
      case "TributeBetrayedAlliance": {
        entry(e.betrayerId, e);
        break;
      }
      case "TributeHid":
      case "TributeRested":
      case "TributeHealthChanged":
      case "TributeAmmunitionChanged":
      case "TributeHungerChanged":
      case "TributeForaged":
      case "TributeGainedItem": {
        // only reach buildFacts when observers own, entry(observedId) returns undefined
        entry(e.tributeId, e);
        break;
      }
      case "TributeChangedZone": {
        const tribute = entry(e.tributeId, e);
        if (tribute) {
          tribute.heading = e.currentZoneId;
        }
        break;
      }
      case "ZoneWaterChanged":
      case "ZoneFoodChanged":
      case "MatchEnded":
      case "ZoneFlooded":
      case "ZoneClosed":
        break;
      default: {
        const unhandled: never = e; // compile error if a case is missing
        return unhandled;
      }
    }
  }

  return facts;
}
