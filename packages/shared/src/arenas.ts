import type { ArenaDefinition } from "./types";

// PLACEHOLDER arena: a small graph to build setup and movement against.
// Replace it with the real Phase 1 arena once the map is designed.
export const arenaDefinitions: ArenaDefinition[] = [
  {
    arenaId: "placeholder",
    name: "Placeholder Arena",
    zones: [
      {
        zoneId: "centre",
        name: "Centre",
        food: 5,
        water: 5,
        cover: 1,
        hazardLevel: 1,
      },
      {
        zoneId: "forest",
        name: "Forest",
        food: 3,
        water: 1,
        cover: 3,
        hazardLevel: 1,
      },
      {
        zoneId: "river",
        name: "River",
        food: 2,
        water: 5,
        cover: 1,
        hazardLevel: 2,
      },
      {
        zoneId: "ridge",
        name: "Ridge",
        food: 1,
        water: 0,
        cover: 2,
        hazardLevel: 3,
      },
    ],
    edges: [
      { from: "centre", to: "forest", cost: 1 },
      { from: "forest", to: "centre", cost: 1 },
      { from: "centre", to: "river", cost: 1 },
      { from: "river", to: "centre", cost: 1 },
      { from: "forest", to: "ridge", cost: 2 },
      { from: "ridge", to: "forest", cost: 2 },
    ],
    startingZoneIds: ["forest", "river"],
  },
];
