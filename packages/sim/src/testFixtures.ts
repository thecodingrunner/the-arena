import { arenaDefinitions } from "@arena/shared";
import type {
  ArenaDefinition,
  MatchConfig,
  TributeConfig,
} from "@arena/shared";

// The arena makeConfig uses. Throws (rather than returning undefined) so tests get a narrowed type.
export const placeholderArena: ArenaDefinition = (() => {
  const arena = arenaDefinitions.find((a) => a.arenaId === "placeholder");
  if (!arena)
    throw new Error("placeholder arena is missing from arenaDefinitions");
  return arena;
})();

// Builds a valid TributeConfig. Override only the fields a test cares about.
export function makeTribute(
  overrides: Partial<TributeConfig> = {},
): TributeConfig {
  return {
    tributeId: "t1",
    stats: {
      strength: 5,
      agility: 5,
      charisma: 5,
      endurance: 5,
      intelligence: 5,
      stealth: 5,
    },
    name: "Tribute One",
    origin: "Saltworks",
    personality: "Cautious and observant.",
    startingWeaponDefId: "spear",
    owner: null,
    ...overrides,
  };
}

// Builds a valid MatchConfig with 3 tributes on the placeholder arena.
// 3 tributes > 2 starting zones, so zone sharing is always exercised.
export function makeConfig(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return {
    matchId: "match-1",
    seed: 42,
    arenaId: "placeholder",
    tributes: [
      makeTribute({
        tributeId: "t1",
        name: "Tribute One",
        startingWeaponDefId: "spear",
      }),
      makeTribute({
        tributeId: "t2",
        name: "Tribute Two",
        startingWeaponDefId: "bow",
      }),
      makeTribute({
        tributeId: "t3",
        name: "Tribute Three",
        startingWeaponDefId: "spear",
      }),
    ],
    ...overrides,
  };
}
