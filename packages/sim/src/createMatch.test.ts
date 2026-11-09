import { describe, expect, test } from "vitest";
import { createRng } from "./rng";
import { createMatch } from "./createMatch";
import { makeConfig, makeTribute, placeholderArena } from "./testFixtures";

describe("createMatch", () => {
  // Creates
  test("all tributes in the match have a hp of 100", () => {
    const matchConfig = makeConfig();
    const N = 3;

    const match = createMatch(matchConfig);

    expect(match.tributes).toHaveLength(N);

    for (const tribute of match.tributes) {
      expect(tribute.hp).toBe(100);
    }
  });

  test("updating the match state zones does not mutate the arena definition zones", () => {
    const matchConfig = makeConfig();

    const arena = placeholderArena;

    const before = arena.zones[0]?.food;

    const match = createMatch(matchConfig);

    match.zones[0]!.food -= 1;

    expect(arena.zones[0]?.food).toEqual(before);
  });

  test("all tributes in the match have hunger of 0", () => {
    const matchConfig = makeConfig();
    const N = 3;

    const match = createMatch(matchConfig);

    expect(match.tributes).toHaveLength(N);

    for (const tribute of match.tributes) {
      expect(tribute.hunger).toBe(0);
    }
  });

  test("all tributes in the match are alive", () => {
    const matchConfig = makeConfig();

    const match = createMatch(matchConfig);

    expect(match.tributes).toHaveLength(3);

    for (const tribute of match.tributes) {
      expect(tribute.alive).toBe(true);
    }
  });

  test("all tributes in the match have a memory of []", () => {
    const matchConfig = makeConfig();

    const match = createMatch(matchConfig);

    expect(match.tributes).toHaveLength(3);

    for (const tribute of match.tributes) {
      expect(tribute.memory).toEqual([]);
    }
  });

  test("tribute has an inventory that holds one WeaponInstance with the id of spear-0", () => {
    const matchConfig = makeConfig();

    const match = createMatch(matchConfig);

    expect(match.tributes).toHaveLength(3);

    for (let i = 0; i < match.tributes.length; i++) {
      expect(match.tributes[i]?.inventory.length).toBe(1);
      expect(match.tributes[i]?.inventory[0]?.kind).toBe("weapon");
      expect(match.tributes.map((t) => t.inventory[0]?.definitionId)).toEqual([
        "spear",
        "bow",
        "spear",
      ]);
      expect(match.tributes.map((t) => t.inventory[0]?.itemId)).toEqual([
        "spear-0",
        "bow-1",
        "spear-2",
      ]);
    }
  });

  test("the round is 0", () => {
    const matchConfig = makeConfig();

    const match = createMatch(matchConfig);

    expect(match.round).toBe(0);
  });

  test("the seq is 0", () => {
    const matchConfig = makeConfig();

    const match = createMatch(matchConfig);

    expect(match.seq).toBe(0);
  });

  test("the nextItemId is tributes.length", () => {
    const matchConfig = makeConfig();

    const match = createMatch(matchConfig);

    expect(match.nextItemId).toBe(match.tributes.length);
  });

  test("rngState is not equal to the state of rng", () => {
    const matchConfig = makeConfig();

    const match = createMatch(matchConfig);

    const rng = createRng(matchConfig.seed);

    expect(match.rngState).not.toBe(rng.getState());
  });

  test("every tribute's position is one of the arena's starting zones", () => {
    const match = createMatch(makeConfig());

    expect(match.tributes).toHaveLength(3);
    for (const tribute of match.tributes) {
      expect(placeholderArena.startingZoneIds).toContain(tribute.position);
    }
  });

  test("tributes are spread evenly across starting zones: 3 tributes over 2 zones gives counts of 2 and 1", () => {
    const match = createMatch(makeConfig());

    const counts = new Map<string, number>();
    for (const tribute of match.tributes) {
      counts.set(tribute.position, (counts.get(tribute.position) ?? 0) + 1);
    }

    expect([...counts.values()].sort()).toEqual([1, 2]);
  });

  test("starting placements vary between seeds", () => {
    const placements = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const match = createMatch(makeConfig({ seed }));
      placements.add(match.tributes.map((t) => t.position).join(","));
    }

    // Without a shuffle every seed gives the same placement, so the set has 1 entry
    expect(placements.size).toBeGreaterThan(1);
  });

  test("starting ammo comes from the definition: bow 3, throwing knifes 6, spear null", () => {
    const match = createMatch(makeConfig({
      tributes: [
        makeTribute({ tributeId: "t1", startingWeaponDefId: "bow" }),
        makeTribute({ tributeId: "t2", startingWeaponDefId: "throwing_knives" }),
        makeTribute({ tributeId: "t3", startingWeaponDefId: "spear" }),
      ]
    }));

    const tribute1Weapon = match.tributes[0]!.inventory.find((w) => w.kind === "weapon");
    const tribute2Weapon = match.tributes[1]!.inventory.find((w) => w.kind === "weapon");
    const tribute3Weapon = match.tributes[2]!.inventory.find((w) => w.kind === "weapon");

    expect(tribute1Weapon!.ammunition).toBe(3);
    expect(tribute2Weapon!.ammunition).toBe(6);
    expect(tribute3Weapon!.ammunition).toBe(null);
  })

  //Determinism
  test("the same config gives the same GameState", () => {
    const matchConfig = makeConfig();

    const match1 = createMatch(matchConfig);
    const match2 = createMatch(matchConfig);

    expect(match1).toEqual(match2);
  });

  // Throws
  test("throws when there are fewer than 2 tributes", () => {
    const matchConfig = makeConfig();

    expect(() => createMatch({ ...matchConfig, tributes: [] })).toThrow(
      "Must have at least 2 tributes",
    );
    expect(() =>
      createMatch({ ...matchConfig, tributes: [makeTribute()] }),
    ).toThrow("Must have at least 2 tributes");
  });

  test("throws when two tributes share a tributeId", () => {
    const matchConfig = makeConfig();

    expect(() =>
      createMatch({
        ...matchConfig,
        tributes: [
          makeTribute({ tributeId: "t1" }),
          makeTribute({ tributeId: "t1" }),
        ],
      }),
    ).toThrow("TributeIds must be unique");
  });

  test("throws when there is a empty matchId", () => {
    const matchConfig = makeConfig();

    expect(() => createMatch({ ...matchConfig, matchId: "" })).toThrow(
      "matchId cannot be empty",
    );
  });

  test("throws when there is a tribute with an invalid startingWeaponDefId", () => {
    const matchConfig = makeConfig();

    expect(() =>
      createMatch({
        ...matchConfig,
        tributes: [
          makeTribute({ tributeId: "t1", startingWeaponDefId: "banana" }),
          makeTribute({ tributeId: "t2" }),
        ],
      }),
    ).toThrow("Invalid startingWeaponDefId");
  });

  test("throws when arenaId is unknown", () => {
    const matchConfig = makeConfig();

    expect(() => createMatch({ ...matchConfig, arenaId: "banana" })).toThrow(
      "Unknown arenaId",
    );
  });
});
