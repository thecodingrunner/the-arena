import type { SponsorItemDefinition } from "./types";

// PLACEHOLDER costs and amounts: tune in the step 13 playtest and Phase 4b (sponsor economy).
// Gifts are applied the moment they land (start of the round) and never stored in an inventory.
// Ammunition gifts go to the matching weapon with the most ammunition (ties: inventory order).
export const sponsorItemDefinitions: SponsorItemDefinition[] = [
  {
    // Same value as finding food (HUNGER_VALUE.food).
    itemDefinitionId: "ration_pack",
    name: "Ration Pack",
    cost: 20,
    effects: [{ kind: "hunger", amount: -30 }],
  },
  {
    // Same value as finding water (HUNGER_VALUE.water).
    itemDefinitionId: "water_flask",
    name: "Water Flask",
    cost: 10,
    effects: [{ kind: "hunger", amount: -15 }],
  },
  {
    // Roughly one hit's worth plus a bit: changes a fight without resetting it.
    itemDefinitionId: "medkit",
    name: "Medkit",
    cost: 40,
    effects: [{ kind: "health", amount: 40 }],
  },
  {
    // A full bow's starting supply.
    itemDefinitionId: "arrows",
    name: "Arrows",
    cost: 25,
    effects: [{ kind: "ammunition", weaponDefinitionId: "bow", amount: 3 }],
  },
  {
    // Half of the knives' starting 6.
    itemDefinitionId: "throwing_knives",
    name: "Throwing Knives",
    cost: 20,
    effects: [
      { kind: "ammunition", weaponDefinitionId: "throwing_knives", amount: 3 },
    ],
  },
];
