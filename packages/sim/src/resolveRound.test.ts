import { describe, expect, test } from "vitest";
import {
  anyEventInvolves,
  filterEvents,
  findEvent,
  makeConfig,
  zoneOf,
} from "./testFixtures";
import { createMatch } from "./createMatch";
import { resolveRound } from "./resolveRound";
import { type Action, type GameState, type TributeId } from "@arena/shared";

type RoundActions = Record<TributeId, Action>;

describe("resolveRound", () => {
  // Order
  // - round increases by 1
  // - rngState moves on after a round
  // - actions resolve in initiative order (higher stealth+intelligence usually first — test with a large stat gap)
  // - same state + actions + rngState gives identical state and events (determinism)
  // - a tribute killed earlier in the round has its action skipped   ← needs step 5 to trigger; so will be skipped for now
  // - throws when a living tribute has no action
  test("round increases by 1", () => {
    const restActions: RoundActions = {
      t1: { type: "rest" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    const { state: after } = resolveRound(before, restActions);

    expect(after.round).toBe(before.round + 1);
  });

  test("rngState moves on after a round", () => {
    const restActions: RoundActions = {
      t1: { type: "rest" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    const { state: after } = resolveRound(before, restActions);

    expect(after.rngState).not.toBe(before.rngState);
  });

  test("throws when a living tribute has no action", () => {
    const restActions: RoundActions = {
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    expect(() => resolveRound(before, restActions)).toThrow(
      "no action for tribute t1",
    );
  });

  test("dead tributes don't act (action is skipped)", () => {
    const restActions: RoundActions = {
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    before.tributes[0]!.alive = false;
    const { events } = resolveRound(before, restActions);

    const involves = anyEventInvolves(events, "t1");

    expect(involves).toBe(false);
  });

  test("initiative order with a big stat gap (tribute with higher stealth+intelligence first)", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "forage" },
      t3: { type: "forage" },
    };

    for (let i = 0; i < 20; i++) {
      const before = stateWithHunger(i, 50, 3);

      before.tributes[0]!.stats.stealth = 10;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[1]!.stats.stealth = 1;
      before.tributes[1]!.stats.intelligence = 1;
      before.tributes[2]!.stats.stealth = 1;
      before.tributes[2]!.stats.intelligence = 1;

      const { events } = resolveRound(before, forageActions);

      const foragedT1 = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t1",
      );
      const foragedT2 = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t2",
      );
      const foragedT3 = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t3",
      );

      // tribute t1 will have a minimum initiative score of 21,
      // and the others will have a maximum score of 7, so t1
      // should always be first
      expect(foragedT1!.seq).toBeLessThan(foragedT2!.seq);
      expect(foragedT1!.seq).toBeLessThan(foragedT3!.seq);
    }
  });

  test("same state + actions + rngState gives identical state and events (determinism)", () => {
    const actions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "forage" },
      t3: { type: "forage" },
    };

    const match1 = stateWithHunger(2, 50, 3);
    const zone1 = zoneOf(match1, 0);
    zone1.food = 3;

    const match2 = stateWithHunger(2, 50, 3);
    const zone2 = zoneOf(match2, 0);
    zone2.food = 3;

    const { state: after1, events: events1 } = resolveRound(match1, actions);
    const { state: after2, events: events2 } = resolveRound(match2, actions);

    expect(events1.length).toBeGreaterThan(0);
    expect(after1).toEqual(after2);
    expect(events1).toEqual(events2);
  });

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

      const { events } = resolveRound(before, forageActions);

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

  // rest
  // - hp +10, capped at 100

  test.each([
    [50, 60, 10],
    [95, 100, 5],
    [100, 100, 0],
  ])(
    "rest from hp %i -> hp %i (delta %i)",
    (startHp, expectedHp, expectedDelta) => {
      const restActions: RoundActions = {
        t1: { type: "rest" },
        t2: { type: "forage" },
        t3: { type: "forage" },
      };

      const before = createMatch(makeConfig());
      before.tributes[0]!.hp = startHp;
      const { events } = resolveRound(before, restActions);

      expect(events).toContainEqual(
        expect.objectContaining({
          type: "TributeHealthChanged",
          tributeId: "t1",
          delta: expectedDelta,
          hp: expectedHp,
        }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "TributeRested",
          tributeId: "t1",
        }),
      );
    },
  );

  // move_to
  // - position changes to the target, extra hunger = cost × 3, emits TributeChangedZone

  test("move_to: position changes to the target, extra hunger = cost × 3, emits TributeChangedZone", () => {
    const restActions: RoundActions = {
      t1: { type: "move_to", zoneId: "centre" },
      t2: { type: "forage" },
      t3: { type: "forage" },
    };

    const before = createMatch(makeConfig());
    before.tributes[0]!.hunger = 50;
    before.tributes[0]!.position = "forest";
    const { events } = resolveRound(before, restActions);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeChangedZone",
        tributeId: "t1",
        previousZoneId: "forest",
        currentZoneId: "centre",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHungerChanged",
        tributeId: "t1",
        delta: 3,
        hunger: 53,
      }),
    );
  });

  test("move_to: hunger caps at 100", () => {
    const restActions: RoundActions = {
      t1: { type: "move_to", zoneId: "centre" },
      t2: { type: "forage" },
      t3: { type: "forage" },
    };

    const before = createMatch(makeConfig());
    before.tributes[0]!.hunger = 100;
    before.tributes[0]!.position = "forest";
    const { events } = resolveRound(before, restActions);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeChangedZone",
        tributeId: "t1",
        previousZoneId: "forest",
        currentZoneId: "centre",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHungerChanged",
        tributeId: "t1",
        delta: 0,
        hunger: 100,
      }),
    );
  });

  test("move_to: position changes to the target, extra hunger = cost × 3, emits TributeChangedZone", () => {
    const restActions: RoundActions = {
      t1: { type: "move_to", zoneId: "river" },
      t2: { type: "forage" },
      t3: { type: "forage" },
    };

    const before = createMatch(makeConfig());
    before.tributes[0]!.hunger = 50;
    before.tributes[0]!.position = "forest";

    expect(() => resolveRound(before, restActions)).toThrow(
      "t1 can not move from forest to river because there is no edge",
    );
  });

  test("move_to: position changes to the target, extra hunger = cost × 3, emits TributeChangedZone", () => {
    const moveActions: RoundActions = {
      t1: { type: "move_to", zoneId: "nowhere" },
      t2: { type: "forage" },
      t3: { type: "forage" },
    };

    const before = createMatch(makeConfig());
    before.tributes[0]!.hunger = 50;
    before.tributes[0]!.position = "forest";

    expect(() => resolveRound(before, moveActions)).toThrow(
      "nowhere does not exist, so tribute t1 cannot move there",
    );
  });

  // Hunger tick
  // - runs after actions (a tribute at 98 who forages successfully doesn't hit 100)
  // - capped at 100
  // - at 100: hp −10
  // - hp reaching 0 → alive false, TributeDied with cause hunger
  // - dead tributes don't tick

  test("runs after actions (a tribute at 98 who forages successfully doesn't hit 100)", () => {
    const forageActions: RoundActions = {
      t1: { type: "forage" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    for (let seed = 1; seed <= 20; seed++) {
      const before = stateWithHunger(seed, 98);
      const zoneBefore = zoneOf(before, 0);
      zoneBefore.food = 3;

      before.tributes[0]!.stats.endurance = 5;

      const { state: after, events } = resolveRound(before, forageActions);

      const foraged = findEvent(
        events,
        "TributeForaged",
        (e) => e.tributeId === "t1",
      );
      expect(foraged).toBeDefined();
      if (!foraged!.success) continue;

      expect(events).toContainEqual(
        expect.objectContaining({
          type: "TributeHungerChanged",
          tributeId: "t1",
          delta: -30,
        }),
      );

      const lostHealth = findEvent(
        events,
        "TributeHealthChanged",
        (e) => e.tributeId === "t1",
      );

      expect(lostHealth).not.toBeDefined();

      // 98 − 30 (food) = 68, then tick +(10 − floor(5/4)) = +9 → 77
      expect(after.tributes[0]!.hunger).toBe(77);
    }
  });

  test("capped at 100: when hunger hits 100, hp −10", () => {
    const restActions: RoundActions = {
      t1: { type: "rest" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = stateWithHunger(1, 95);
    const { state: after, events } = resolveRound(before, restActions);

    expect(after.tributes[0]!.hunger).toBe(100);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHealthChanged",
        tributeId: "t1",
        delta: -10,
      }),
    );
  });

  test("a starving tribute who doesn't eat or rest dies", () => {
    const restActions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = stateWithHunger(1, 100);
    before.tributes[0]!.hp = 10;

    const { state: after, events } = resolveRound(before, restActions);

    expect(after.tributes[0]!.alive).toBe(false);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeDied",
        victimId: "t1",
        cause: { kind: "hunger" },
      }),
    );
  });

  test("dead tributes don't tick", () => {
    const restActions: RoundActions = {
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    before.tributes[0]!.alive = false;

    const { events } = resolveRound(before, restActions);

    const involves = anyEventInvolves(events, "t1");

    expect(involves).toBe(false);
  });

  // Events
  // - every event has the matchId, the current round and v:1; seq values are consecutive and continue from state.seq
  // - state.seq afterwards = the next unused seq

  test("every event has the matchId, the current round and v:1; seq values are consecutive and continue from state.seq", () => {
    const restActions: RoundActions = {
      t1: { type: "rest" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    before.seq = 42;

    const { events } = resolveRound(before, restActions);

    expect(events.length).toBeGreaterThan(0);

    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      expect(event.matchId).toBe(before.matchId);
      expect(event.round).toBe(before.round + 1);
      expect(event.v).toBe(1);
      expect(event.seq).toBe(42 + i);
    }
  });

  test("state.seq afterwards = the next unused seq", () => {
    const restActions: RoundActions = {
      t1: { type: "rest" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    before.seq = 42;
    const { state: after, events } = resolveRound(before, restActions);

    expect(after.seq).toBe(42 + events.length);
  });
});
