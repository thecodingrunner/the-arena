import { arenaDefinitions } from "@arena/shared";
import type {
  ArenaDefinition,
  GameEvent,
  GameState,
  MatchConfig,
  SponsorGift,
  TributeConfig,
  TributeId,
  Zone,
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

// Builds n valid tributes t1…tn with default stats. Weapons cycle so a match has a mix.
// Use for anything that needs more than makeConfig's 3: makeConfig({ tributes: makeTributes(8) })
export function makeTributes(n: number): TributeConfig[] {
  const weapons = ["spear", "bow", "machete", "throwing_knives", "crowbar"];
  return Array.from({ length: n }, (_, i) =>
    makeTribute({
      tributeId: `t${i + 1}`,
      name: `Tribute ${i + 1}`,
      startingWeaponDefId: weapons[i % weapons.length]!,
    }),
  );
}

// Marks a tribute dead the way the engine does: hp 0, alive false, diedInRound set.
// Keeps tests from arranging a half-dead state the engine could never produce.
export function markDead(
  state: GameState,
  tributeIndex: number,
  round: number,
): void {
  const tribute = state.tributes[tributeIndex];
  if (!tribute) throw new Error(`no tribute at index ${tributeIndex}`);
  tribute.hp = 0;
  tribute.alive = false;
  tribute.diedInRound = round;
}

// Builds a valid SponsorGift: a medkit for t1, landing in round 1
// (createMatch starts at round 0, so the first resolveRound is round 1).
// Override only what a test cares about: makeGift({ to: "t2", itemDefinitionId: "arrows" })
export function makeGift(overrides: Partial<SponsorGift> = {}): SponsorGift {
  return {
    giftId: "g1",
    from: null,
    to: "t1",
    itemDefinitionId: "medkit",
    appliesInRound: 1,
    ...overrides,
  };
}

type EventOfType<T extends GameEvent["type"]> = Extract<GameEvent, { type: T }>;

// Finds the first event of a type, typed as that event. Optional filter on its fields.
export function findEvent<T extends GameEvent["type"]>(
  events: GameEvent[],
  type: T,
  where: (event: EventOfType<T>) => boolean = () => true,
): EventOfType<T> | undefined {
  return filterEvents(events, type, where)[0];
}

export function anyEventInvolves(
  events: GameEvent[],
  tributeId: TributeId,
): boolean {
  const involves = (e: GameEvent, id: TributeId) =>
    Object.values(e).includes(id);
  for (const e of events) if (involves(e, tributeId)) return true;
  return false;
}

// All events of a type, typed as that event. Optional filter on their fields.
export function filterEvents<T extends GameEvent["type"]>(
  events: GameEvent[],
  type: T,
  where: (event: EventOfType<T>) => boolean = () => true,
): EventOfType<T>[] {
  return events.filter(
    (e): e is EventOfType<T> => e.type === type && where(e as EventOfType<T>),
  );
}

// The zone a tribute is standing in. Returns the state's own object, so tests can arrange it:
// zoneOf(state, 0).food = 1
export function zoneOf(state: GameState, tributeIndex: number): Zone {
  const tribute = state.tributes[tributeIndex];
  if (!tribute) throw new Error(`no tribute at index ${tributeIndex}`);
  const zone = state.zones.find((z) => z.zoneId === tribute.position);
  if (!zone) throw new Error(`zone ${tribute.position} is not in state.zones`);
  return zone;
}
