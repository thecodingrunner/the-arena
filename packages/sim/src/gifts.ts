import {
  sponsorItemDefinitions,
  type SponsorGift,
  type Tribute,
  type WeaponInstance,
} from "@arena/shared";
import type { Ctx } from "./ctx";
import { MAX_HP } from "./rules";

export function resolveGifts(ctx: Ctx, gifts: SponsorGift[]): void {
  const { emitEvent, copiedGameState } = ctx;

  const ids = gifts.map((g) => g.giftId);
  const duplicates = ids
    .filter((id, index) => ids.indexOf(id) !== index);

  if (duplicates.length > 0) {
    throw new Error(
      `giftIds must be unique, found duplicates: ${duplicates.join(", ")}`,
    );
  }

  for (const gift of gifts) {
    const tribute = copiedGameState.tributes.find(
      (t) => t.tributeId === gift.to,
    );

    if (!tribute) {
      throw new Error(`Tribute ${gift.to} does not exist`);
    }

    if (gift.appliesInRound !== copiedGameState.round) {
      throw new Error(
        `Gift ${gift.giftId} does not apply in round ${copiedGameState.round}`,
      );
    }

    const itemDefinition = sponsorItemDefinitions.find(
      (i) => i.itemDefinitionId === gift.itemDefinitionId,
    );

    if (!itemDefinition) {
      throw new Error(
        `Item definition ${gift.itemDefinitionId} does not exist`,
      );
    }

    if (tribute.alive === false) {
      emitEvent({
        type: "SponsorGiftUndelivered",
        giftId: gift.giftId,
        to: gift.to,
        reason: "recipientDead",
        location: tribute.position,
      });
      continue;
    }

    const missingWeapon = itemDefinition.effects.some(
      (e) =>
        e.kind === "ammunition" &&
        !findAmmoTarget(tribute, e.weaponDefinitionId),
    );

    if (missingWeapon) {
      emitEvent({
        type: "SponsorGiftUndelivered",
        giftId: gift.giftId,
        to: gift.to,
        reason: "noMatchingWeapon",
        location: tribute.position,
      });
      continue;
    }

    emitEvent({
      type: "SponsorGiftDelivered",
      giftId: gift.giftId,
      senderId: gift.from,
      to: gift.to,
      itemDefinitionId: gift.itemDefinitionId,
      appliedInRound: gift.appliesInRound,
      location: tribute.position,
    });

    for (const effect of itemDefinition.effects) {
      switch (effect.kind) {
        case "hunger": {
          const newHunger = Math.max(0, tribute.hunger + effect.amount);
          const delta = newHunger - tribute.hunger;
          tribute.hunger = newHunger;
          emitEvent({
            type: "TributeHungerChanged",
            tributeId: gift.to,
            delta: delta,
            hunger: tribute.hunger,
            location: tribute.position,
          });
          break;
        }
        case "health": {
          const newHealth = Math.min(MAX_HP, tribute.hp + effect.amount);
          const healthDelta = newHealth - tribute.hp;
          tribute.hp = newHealth;
          emitEvent({
            type: "TributeHealthChanged",
            tributeId: gift.to,
            delta: healthDelta,
            hp: tribute.hp,
            location: tribute.position,
          });
          break;
        }
        case "ammunition": {
          const weapon = findAmmoTarget(tribute, effect.weaponDefinitionId)!;
          weapon.ammunition! += effect.amount;

          emitEvent({
            type: "TributeAmmunitionChanged",
            tributeId: gift.to,
            itemId: weapon.itemId,
            delta: effect.amount,
            ammunition: weapon.ammunition!,
            location: tribute.position,
          });

          break;
        }
        default: {
            const unhandled: never = effect;
            throw new Error(`Unhandled effect kind: ${JSON.stringify(unhandled)}`);
        }
      }
    }
  }
}

function findAmmoTarget(tribute: Tribute, weaponDefinitionId: string): WeaponInstance | undefined {
  const weapon = tribute.inventory
    .filter(
      (i) =>
        i.definitionId === weaponDefinitionId && i.ammunition !== null,
    )
    .sort(
      (i1, i2) => i2.ammunition! - i1.ammunition!,
    )[0];
  return weapon;
}
