// n identical-strength AI tributes. 6 in every stat = the 36-point budget, under the cap of 10.

import type { District, TributeConfig } from "@arena/shared";

// Weapons and origins cycle so a match has a mix. Real tributes come from the creator in Phase 3.
export function makeCliTributes(n: number): TributeConfig[] {
  const weapons = ["spear", "bow", "machete", "throwing_knives", "crowbar"];
  const origins: District[] = [
    "Saltworks",
    "Glassmouth",
    "Blackfenn",
    "The Quaries",
    "Hollow Pines",
  ];
  return Array.from({ length: n }, (_, i) => ({
    tributeId: `t${i + 1}`,
    name: `Tribute ${i + 1}`,
    origin: origins[i % origins.length]!,
    personality: "",
    startingWeaponDefId: weapons[i % weapons.length]!,
    owner: null,
    stats: {
      strength: 6,
      agility: 6,
      charisma: 6,
      endurance: 6,
      intelligence: 6,
      stealth: 6,
    },
  }));
}