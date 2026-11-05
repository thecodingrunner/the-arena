import { describe, expect, test } from "vitest";
import { filterEvents, findEvent, makeConfig, zoneOf } from "./testFixtures";
import { createMatch } from "./createMatch";
import { resolveRound } from "./resolveRound";
import {
  type Action,
  type GameState,
  type TributeId,
  type WeaponInstance,
} from "@arena/shared";

type RoundActions = Record<TributeId, Action>;

describe("resolveRound", () => {
  // Order
  // - round increases by 1
  // - actions resolve in initiative order (higher stealth+intelligence usually first — test with a large stat gap)
  // - same state + actions + rngState gives identical state and events (determinism)
  // - a tribute killed earlier in the round has its action skipped   ← needs step 5 to trigger; so will be skipped for now
  // - throws when a living tribute has no action
  test.todo("round increases by 1");

  // forage
  // - success with food in zone: food −1, hunger −30, emits TributeForaged{success:true}, ZoneFoodChanged, TributeHungerChanged
  // - no food but water: water −1, hunger −15
  // - no food and no water: hunger unchanged, TributeForaged{success:false}
  // - hunger never goes below 0
  // - with food: 1 and two foragers, only one gets it

  function stateWithHunger(seed: number, hunger: number, count = 1): GameState {
    const state = createMatch(makeConfig({ seed }));
    for (let i = 0; i < count; i++) {
      state.tributes[i]!.hunger = hunger;
    }
    return state;
  }

  test("success forage with food in zone: food −1, hunger −30, emits three events", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let successes = 0;

    for (let seed = 1; seed <= 20; seed++) {
      const before = stateWithHunger(seed, 50);
      const zoneBefore = zoneOf(before, 0);
      zoneBefore.food = 3;
      const foodBefore = zoneBefore.food;

      const { state: after, events } = resolveRound(before, forageActions);

      const foraged = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t1",
      );
      expect(foraged).toBeDefined();
      if (!foraged!.success) continue;

      successes++;
      expect(zoneOf(after, 0).food).toBe(foodBefore - 1);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "ZoneFoodChanged",
          zoneId: zoneBefore.zoneId,
          delta: -1,
        }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "TributeHungerChanged",
          tributeId: "t1",
          delta: -30,
        }),
      );
    }

    expect(successes).toBeGreaterThan(0);
  });

  test("no food but water: water −1, hunger −15", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let successes = 0;

    for (let seed = 1; seed <= 20; seed++) {
      const before = stateWithHunger(seed, 50);
      const zoneBefore = zoneOf(before, 0);
      const zoneId = zoneBefore.zoneId;
      zoneBefore.food = 0;
      zoneBefore.water = 2;
      const waterBefore = zoneBefore.water;

      const { state: after, events } = resolveRound(before, forageActions);

      const foraged = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t1",
      );
      expect(foraged).toBeDefined();
      if (!foraged!.success) continue;

      successes++;
      expect(zoneOf(after, 0).water).toBe(waterBefore - 1);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "ZoneWaterChanged",
          zoneId,
          delta: -1,
        }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "TributeHungerChanged",
          tributeId: "t1",
          delta: -15,
        }),
      );
    }

    expect(successes).toBeGreaterThan(0);
  });

  test("no food and no water: hunger unchanged, TributeForaged{success:false}", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    for (let seed = 1; seed <= 20; seed++) {
      const before = stateWithHunger(seed, 50);
      const zoneBefore = zoneOf(before, 0);
      zoneBefore.food = 0;
      zoneBefore.water = 0;
      const foodBefore = zoneBefore.food;
      const waterBefore = zoneBefore.water;

      const { state: after, events } = resolveRound(before, forageActions);

      const foraged = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t1",
      );
      expect(foraged).toBeDefined();

      expect(
        findEvent(
          events,
          "TributeHungerChanged",
          (e) => e.tributeId === "t1" && e.delta < 0,
        ),
      ).toBeUndefined();

      expect(zoneOf(after, 0).food).toBe(foodBefore);
      expect(zoneOf(after, 0).water).toBe(waterBefore);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "TributeForaged",
          tributeId: "t1",
          success: false,
        }),
      );
    }
  });

  test("hunger never goes below 0", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let successes = 0;

    for (let seed = 1; seed <= 20; seed++) {
      const before = stateWithHunger(seed, 0);
      const zoneBefore = zoneOf(before, 0);
      const zoneId = zoneBefore.zoneId;
      zoneBefore.food = 3;
      zoneBefore.water = 3;
      const foodBefore = zoneBefore.food;

      const { state: after, events } = resolveRound(before, forageActions);

      const foraged = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t1",
      );
      expect(foraged).toBeDefined();
      if (!foraged!.success) continue;

      successes++;
      expect(zoneOf(after, 0).food).toBe(foodBefore - 1);
      expect(events).toContainEqual(
        expect.objectContaining({ type: "ZoneFoodChanged", zoneId, delta: -1 }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "TributeHungerChanged",
          tributeId: "t1",
          delta: 0,
          hunger: 0,
        }),
      );
    }

    expect(successes).toBeGreaterThan(0);
  });

  test("with food: 1 and two foragers, only one gets it", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "forage" },
      t3: { type: "rest" },
    };

    let foodChangedEvents = 0;

    for (let seed = 1; seed <= 20; seed++) {
      const before = stateWithHunger(seed, 50, 2);
      const zoneBefore = zoneOf(before, 0);
      const zoneId = zoneBefore.zoneId;
      before.tributes[1]!.position = zoneId;
      zoneBefore.food = 1;
      zoneBefore.water = 0;

      const { state: after, events } = resolveRound(before, forageActions);

      const foodAfter = zoneOf(after, 0).food;

      const someoneAte =
        filterEvents(events, "ZoneFoodChanged", (e) => e.zoneId === zoneId)
          .length === 1;
      const otherMissedOut =
        filterEvents(events, "TributeForaged", (e) => e.success === false)
          .length === 1;
      const contentionSeen = someoneAte && otherMissedOut;
      if (contentionSeen) foodChangedEvents++;

      expect(foodAfter).toBeOneOf([0, 1]);

      expect(
        filterEvents(events, "ZoneFoodChanged", (e) => e.zoneId === zoneId)
          .length,
      ).toBeLessThanOrEqual(1);
    }

    expect(foodChangedEvents).toBeGreaterThan(0);
  });

  test("delta is -10 when the tribute successfully forages with hunger 10", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let successes = 0;

    for (let seed = 1; seed <= 20; seed++) {
      const before = stateWithHunger(seed, 10);
      const zoneBefore = zoneOf(before, 0);
      const zoneId = zoneBefore.zoneId;
      zoneBefore.food = 3;
      zoneBefore.water = 3;
      const foodBefore = zoneBefore.food;

      const { state: after, events } = resolveRound(before, forageActions);

      const foraged = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t1",
      );
      expect(foraged).toBeDefined();
      if (!foraged!.success) continue;

      successes++;
      expect(zoneOf(after, 0).food).toBe(foodBefore - 1);
      expect(events).toContainEqual(
        expect.objectContaining({ type: "ZoneFoodChanged", zoneId, delta: -1 }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "TributeHungerChanged",
          tributeId: "t1",
          delta: -10,
          hunger: 0,
        }),
      );
    }

    expect(successes).toBeGreaterThan(0);
  });

  test("over 200 seeds, with a intelligence 5 and spear bonus 1, the forage success rate is 0.7 within +-0.1", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let successes = 0;

    for (let seed = 1; seed <= 200; seed++) {
      const before = stateWithHunger(seed, 50);
      before.tributes[0]!.stats.intelligence = 5;
      const zoneBefore = zoneOf(before, 0);
      zoneBefore.food = 3;
      zoneBefore.water = 3;

      const { state: after, events } = resolveRound(before, forageActions);

      const foraged = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t1",
      );
      expect(foraged).toBeDefined();
      if (!foraged!.success) continue;

      successes++;
    }

    expect(successes).toBeGreaterThanOrEqual(200 * 0.6);
    expect(successes).toBeLessThanOrEqual(200 * 0.8);
  });
});

// rest
// - hp +10, capped at 100

// move_to
// - position changes to the target, extra hunger = cost × 3, emits TributeChangedZone

// Hunger tick
// - runs after actions (a tribute at 98 who forages successfully doesn't hit 100)
// - capped at 100
// - at 100: hp −10
// - hp reaching 0 → alive false, TributeDied with cause hunger
// - dead tributes don't tick

// Events
// - every event has the matchId, the current round and v:1; seq values are consecutive and continue from state.seq
// - state.seq afterwards = the next unused seq
