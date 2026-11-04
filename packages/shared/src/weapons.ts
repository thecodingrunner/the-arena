import type { WeaponDefinition } from "./types";

// PLACEHOLDER numbers: enough for setup and tests. Tune these when combat is designed.
export const weaponDefinitions: WeaponDefinition[] = [
  {
    weaponDefinitionId: "spear",
    name: "Spear",
    range: 1,
    attackSpeed: 1,
    power: 6,
    foragingBonus: 1,
    scalesWith: "strength",
  },
  {
    weaponDefinitionId: "bow",
    name: "Bow",
    range: 2,
    attackSpeed: 1,
    power: 4,
    foragingBonus: 2,
    scalesWith: "agility",
  },
  {
    weaponDefinitionId: "knife",
    name: "Knife",
    range: 0,
    attackSpeed: 2,
    power: 3,
    foragingBonus: 1,
    scalesWith: "stealth",
  },
];
