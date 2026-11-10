import type { Perception } from "@arena/shared";

// Builds a valid, unremarkable Perception: every action type is possible
// (food to forage, two zones to move to, one tribute to hunt).
// Override only the fields a test cares about: makePerception({ visibleTributes: [] })
// Mirrors the placeholder arena: forest connects to centre and ridge.
export function makePerception(
  overrides: Partial<Perception> = {},
): Perception {
  return {
    round: 1,
    self: {
      tributeId: "t1",
      hp: 100,
      hunger: 0,
      stats: {
        strength: 5,
        agility: 5,
        charisma: 5,
        endurance: 5,
        intelligence: 5,
        stealth: 5,
      },
      position: "forest",
      inventory: [
        {
          kind: "weapon",
          itemId: "spear-0",
          definitionId: "spear",
          ammunition: null,
        },
      ],
    },
    zone: { zoneId: "forest", food: 3, water: 1, cover: 2 },
    adjacentZoneIds: ["centre", "ridge"],
    visibleTributes: [{ tributeId: "t2", name: "Tribute Two", hidLastRound: false }],
    ...overrides,
  };
}
