import type { WeaponDefinition } from "./types";

// PLACEHOLDER numbers: tune them in the step 13 playtest (random-agent mode can measure match length).
// Damage = power + stats[scalesWith] * WEAPON_DAMAGE_BONUS (2) - floor(victim endurance * 0.5).
// Power is the main term (20–28) and the stat is a modifier (2–20), so weapon choice matters.
// An even fight takes about 3–4 hits to kill from 100 HP. Nothing kills from full HP in one hit.
// Ids stay short ("bow", not "recurve_bow") because they appear in events and tests.
export const weaponDefinitions: WeaponDefinition[] = [
  {
    // Strength builds. Reliable, no ammunition.
    weaponDefinitionId: "spear",
    name: "Spear",
    power: 24,
    foragingBonus: 1,
    scalesWith: "strength",
    startingAmmunition: null,
    ranged: false,
  },
  {
    // Agility builds' long-term weapon once the arrows run out. Good for foraging.
    weaponDefinitionId: "machete",
    name: "Machete",
    power: 22,
    foragingBonus: 2,
    scalesWith: "agility",
    startingAmmunition: null,
    ranged: false,
  },
  {
    // Endurance builds. Lowest melee power, because endurance already cuts hunger and damage taken.
    weaponDefinitionId: "crowbar",
    name: "Crowbar",
    power: 20,
    foragingBonus: 0,
    scalesWith: "endurance",
    startingAmmunition: null,
    ranged: false,
  },
  {
    // Hardest hitter and ranged, but only a few arrows.
    weaponDefinitionId: "bow",
    name: "Recurve Bow",
    power: 28,
    foragingBonus: 2,
    scalesWith: "agility",
    startingAmmunition: 3,
    ranged: true,
  },
  {
    // Stealth builds. Ranged, with more ammunition than the bow but no melee fallback.
    weaponDefinitionId: "throwing_knives",
    name: "Throwing Knives",
    power: 20,
    foragingBonus: 1,
    scalesWith: "stealth",
    startingAmmunition: 6,
    ranged: true,
  },
  {
    // Fallback when a tribute has no usable weapon. Never in an inventory, never looted.
    weaponDefinitionId: "unarmed",
    name: "Unarmed",
    power: 8,
    foragingBonus: 0,
    scalesWith: "strength",
    startingAmmunition: null,
    ranged: false,
  },
];
