import { describe, expect, test } from "vitest";
import {
  anyEventInvolves,
  filterEvents,
  findEvent,
  makeConfig,
  zoneOf,
} from "./testFixtures";
import { createMatch } from "./createMatch";
import { damage, hitChance, resolveRound } from "./resolveRound";
import {
  weaponDefinitions,
  type Action,
  type GameState,
  type TributeId,
  type WeaponDefinition,
  type WeaponInstance,
} from "@arena/shared";

type RoundActions = Record<TributeId, Action>;

describe("resolveRound", () => {
  test("does not modify the input state", () => {
    const someActions: RoundActions = {
      t1: { type: "rest" },
      t2: { type: "forage" },
      t3: { type: "move_to", zoneId: "centre" },
    };
    const before = createMatch(makeConfig());
    before.tributes[2]!.position = "forest";
    const snapshot = structuredClone(before);
    resolveRound(before, someActions);
    expect(before).toEqual(snapshot);
  });

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

  // Checks
  // - if target is dead, the attack fails with an outcome of targetGone
  // - if the target is gone, the attack fails with an outcome of targetGone
  // - the target hides, and the attacker cannot spot the target, the attack fails with an outcome of notFound
  // - the target hides, but the attacker can spot the target, the attack succeeds
  // - if the target does not hide, the attacker always spots the target
  // - can't hurt an ally: step 9/alliances
  // - throws error if targetId is not a real tribute

  test("if target is dead, the attack fails with an outcome of targetGone", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    before.tributes[1]!.alive = false;

    const { events } = resolveRound(before, actions);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeAttacked",
        attackerId: "t1",
        victimId: "t2",
        outcome: "targetGone",
      }),
    );
  });

  test("if the target has moved to a different zone, the attack fails with an outcome of targetGone", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    before.tributes[0]!.position = "forest";
    before.tributes[1]!.position = "centre";

    const { events } = resolveRound(before, actions);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeAttacked",
        attackerId: "t1",
        victimId: "t2",
        outcome: "targetGone",
      }),
    );
  });

  test("a master hider is never found: victim stealth 10; attacker intelligence 1", () => {
    // victim: 10 × 1.5 + d6 = 16–21; hunter: 1 + d6 = 2–7 → never overlap

    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hide" },
      t3: { type: "rest" },
    };

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.stealth = 10;
      before.tributes[1]!.stats.intelligence = 10;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.stealth = 1;
      before.tributes[0]!.stats.intelligence = 1;
      before.tributes[0]!.position = "forest";

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );
      expect(attack?.outcome).toBe("notFound");
    }
  });

  test("a genius hunter always finds: victim stealth 1, attacker intelligence 10", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hide" },
      t3: { type: "rest" },
    };

    let hidesFirstOccurrences = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.stealth = 1;
      before.tributes[1]!.stats.intelligence = 10;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.stealth = 1;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.position = "forest";

      const { events } = resolveRound(before, actions);

      const hide = findEvent(events, "TributeHid", (e) => e.tributeId === "t2");

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (hide && attack && hide.seq < attack.seq) {
        hidesFirstOccurrences++;
        expect(attack?.outcome).not.toBe("notFound");
      }
    }

    expect(hidesFirstOccurrences).toBeGreaterThan(5);
  });

  test("evenly matched spotting gives both", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hide" },
      t3: { type: "rest" },
    };

    let successfulAttacks = 0;
    let successfulHides = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.stealth = 1;
      before.tributes[1]!.stats.intelligence = 10;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.stealth = 1;
      before.tributes[0]!.stats.intelligence = 1;
      before.tributes[0]!.position = "forest";

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );
      if (attack && attack.outcome !== "notFound") {
        successfulAttacks++;
      }

      if (attack && attack.outcome === "notFound") {
        successfulHides++;
      }
    }

    expect(successfulAttacks).toBeGreaterThan(0);
    expect(successfulHides).toBeGreaterThan(0);
  });

  test("if the target does not hide, the attacker always spots the target", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.position = "forest";

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );
      expect(attack?.outcome).not.toBe("notFound");
    }
  });

  test("a tribute can't hunt themself, should throw an error", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t1" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    expect(() =>
      resolveRound(createMatch(makeConfig({ seed: 0 })), actions),
    ).toThrow("a tribute can't hunt themself");
  });

  // Weapon
  // - a bow with 0 ammo is skipped by chooseWeapon
  // - ammo goes down by 1 on hit and missed, but not on notFound or targetGone (TributeAmmunition changed is emmitted)
  // - when the attacker has more than one weapon, chooseWeapon picks the weapon with the highest damage for that attacker
  // - when the attacker has no weapon, the attack weapon falls back to unarmed
  // - unarmed never appears in an inventory, and isn't looted either
  // - hit/missed: −1, TributeAmmunitionChanged with ammunition: 9
  // - targetGone: t2 in another zone, no ammo event, still 10
  // - notFound: master-hider stats with t2 hiding, no ammo event, still 10

  test("a bow with 0 ammo is skipped by chooseWeapon, the attack weapon falls back to unarmed", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let successes = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.intelligence = 10;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.stealth = 1;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        { definitionId: "bow", ammunition: 0, kind: "weapon", itemId: "b1" },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );
      if (attack?.outcome === "hit") {
        successes++;
      }

      if (attack?.outcome === "missed" || attack?.outcome === "hit") {
        expect(attack?.weaponDefinitionId).toBe("unarmed");
      }
    }

    expect(successes).toBeGreaterThan(0);
  });

  test("when t1 attacks with two bows in their inventory, one without ammo, the attack weapon will be the bow with ammo", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());

    before.tributes[0]!.position = "forest";
    before.tributes[0]!.inventory = [
      { definitionId: "bow", ammunition: 0, kind: "weapon", itemId: "b1" },
      { definitionId: "bow", ammunition: 10, kind: "weapon", itemId: "b2" },
    ];
    before.tributes[1]!.position = "forest";

    const { events } = resolveRound(before, actions);

    const attack = findEvent(
      events,
      "TributeAttacked",
      (e) => e.attackerId === "t1",
    );

    expect(attack?.weaponDefinitionId).toBe("bow");
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeAmmunitionChanged",
        tributeId: "t1",
        itemId: "b2",
        ammunition: 9,
        delta: -1,
      }),
    );
  });

  test("when t1 has a bow (ammo 10) and agility 10 and intelligence 10 (guarrenteed initiative), and t1 and t2 both attack each other, t2's attack must be pinned down whenever t1 hits", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hunt", targetId: "t1" },
      t3: { type: "rest" },
    };

    let successes = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.position = "forest";
      before.tributes[1]!.stats.intelligence = 1;
      before.tributes[1]!.stats.agility = 1;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.stats.agility = 10;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        { definitionId: "bow", ammunition: 10, kind: "weapon", itemId: "b1" },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack && attack.outcome === "hit") {
        successes++;
        const attack2 = findEvent(
          events,
          "TributeAttacked",
          (e) => e.attackerId === "t2",
        );
        expect(attack2?.outcome).toBe("pinnedDown");
        expect(attack2?.weaponDefinitionId).toBe(null);
        expect(events).not.toContainEqual(
          expect.objectContaining({
            type: "TributeAmmunitionChanged",
            tributeId: "t2",
          }),
        );
      }
    }

    expect(successes).toBeGreaterThan(0);
  });

  test("ranged hit, but the victim acted earlier in initiative: attack happens as normal", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hunt", targetId: "t1" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    before.tributes[1]!.position = "forest";
    before.tributes[1]!.stats.intelligence = 10;
    before.tributes[1]!.stats.agility = 10;
    before.tributes[1]!.inventory = [
      {
        definitionId: "spear",
        ammunition: null,
        kind: "weapon",
        itemId: "s1",
      },
    ];
    before.tributes[0]!.stats.intelligence = 1;
    before.tributes[0]!.stats.agility = 1;
    before.tributes[0]!.position = "forest";
    before.tributes[0]!.inventory = [
      { definitionId: "bow", ammunition: 10, kind: "weapon", itemId: "b1" },
    ];

    const { events } = resolveRound(before, actions);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t1",
        weaponDefinitionId: "spear",
      }),
    );
  });

  test("hit/missed: −1, TributeAmmunitionChanged with ammunition: 9", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hide" },
      t3: { type: "rest" },
    };

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.intelligence = 10;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.stealth = 1;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        { definitionId: "bow", ammunition: 10, kind: "weapon", itemId: "b1" },
      ];

      const { state: after, events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );
      if (attack?.outcome === "hit" || attack?.outcome === "missed") {
        expect(
          (after.tributes[0]!.inventory[0]! as WeaponInstance).ammunition,
        ).toBe(9);
        expect(events).toContainEqual(
          expect.objectContaining({
            type: "TributeAmmunitionChanged",
            tributeId: "t1",
            itemId: "b1",
            delta: -1,
            ammunition: 9,
          }),
        );
      }
    }
  });

  test("when the attacker has more than one weapon, chooseWeapon picks the weapon with the highest damage for that attacker", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig());
    before.tributes[1]!.stats.stealth = 1;
    before.tributes[1]!.position = "forest";
    before.tributes[0]!.stats.agility = 1;
    before.tributes[0]!.stats.strength = 10;
    before.tributes[0]!.stats.intelligence = 10;
    before.tributes[0]!.position = "forest";

    before.tributes[0]!.inventory = [
      { definitionId: "bow", kind: "weapon", itemId: "s1", ammunition: 10 },
      { definitionId: "spear", kind: "weapon", itemId: "s2", ammunition: null },
    ];

    // chooseWeapon will always pick spear, since it has the highest damage (24 + 10*2 = 44 > 28 + 1*2 = 30)

    const { events } = resolveRound(before, actions);

    const attack = findEvent(
      events,
      "TributeAttacked",
      (e) => e.attackerId === "t1",
    );
    if (attack?.outcome === "hit" || attack?.outcome === "missed") {
      expect(attack?.weaponDefinitionId).toBe("spear");
    }
  });

  test("targetGone: t2 in another zone, no ammo event, still 10", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hide" },
      t3: { type: "rest" },
    };

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.intelligence = 10;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.stealth = 1;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        { definitionId: "bow", ammunition: 10, kind: "weapon", itemId: "b1" },
      ];

      const { state: after, events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack?.outcome === "targetGone") {
        expect(events).not.toContainEqual(
          expect.objectContaining({
            type: "TributeAmmunitionChanged",
            tributeId: "t1",
            itemId: "b1",
          }),
        );
        expect(
          (after.tributes[0]!.inventory[0]! as WeaponInstance).ammunition,
        ).toBe(10);
      }
    }
  });

  test("notFound: master-hider stats with t2 hiding, no ammo event, still 10", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hide" },
      t3: { type: "rest" },
    };

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.intelligence = 10;
      before.tributes[1]!.stats.stealth = 10;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.stealth = 1;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        { definitionId: "bow", ammunition: 10, kind: "weapon", itemId: "b1" },
      ];

      const { state: after, events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack?.outcome === "notFound") {
        expect(events).not.toContainEqual(
          expect.objectContaining({
            type: "TributeAmmunitionChanged",
            tributeId: "t1",
            itemId: "b1",
          }),
        );
        expect(
          (after.tributes[0]!.inventory[0]! as WeaponInstance).ammunition,
        ).toBe(10);
      }
    }
  });

  test("a victim with no weapons gives no TributeGained item (unarmed doesn't show up in the inventory)", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let successfulKills = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.stats.stealth = 10;
      before.tributes[0]!.inventory = [
        { definitionId: "bow", ammunition: 10, kind: "weapon", itemId: "b1" },
      ];
      before.tributes[0]!.position = "forest";
      before.tributes[1]!.position = "forest";
      before.tributes[1]!.hp = 1;
      before.tributes[1]!.inventory = [];

      const { events } = resolveRound(before, actions);

      const tributeDied = findEvent(
        events,
        "TributeDied",
        (e) => e.victimId === "t2",
      );

      if (tributeDied) {
        successfulKills++;
      }

      expect(events).not.toContainEqual(
        expect.objectContaining({
          type: "TributeGainedItem",
          tributeId: "t1",
        }),
      );
    }

    expect(successfulKills).toBeGreaterThan(0);
  });

  // Hit and damage
  // - over 200 attack attempts, for an attacker using a spear of strength 5, and a victim with agility 5, the hit rate is 0.7 within +-0.1 (0.2 + 1.0 - 0.5 = 0.7)
  // - for a spear of power 24, an attacker strength of 5, and a victim endurance of 5, the damage will be 32 (24 + 10 − floor(2.5) = 32)
  // - higher victim agility gives a lower hit rate over the same seeds
  // - higher victim endurance gives less damage
  // - the hit chance cannot go below 0.1, and cannot go above 0.8
  // - the damage never falls below the minimum-damage clamp

  test.each([
    [1, 10, 0.1],
    [10, 1, 0.8],
    [6, 6, 0.5],
  ])(
    "an attacker stat of %i and a defender agility of %i will have a hit chance of %d",
    (attackerStat, defenderAgility, expectedChance) => {
      // 0.2 + 0.1 − 0.5 = −0.2 → 0.1
      // 0.2 + 1.0 − 0.05 = 1.15 → 0.8

      const before = createMatch(makeConfig());
      const { tributes } = before;

      const weaponId = "spear";
      const weapon: WeaponDefinition = weaponDefinitions.find(
        (d) => d.weaponDefinitionId === weaponId,
      )!;
      tributes[0]!.stats.strength = attackerStat;
      tributes[1]!.stats.agility = defenderAgility;

      const chance = hitChance(tributes[0]!, tributes[1]!, weapon);

      expect(chance).toBeCloseTo(expectedChance);
    },
  );

  test("the hitChance scales with the weapon's stat: a bow uses agility, so strength 10 and agility 1 gives 0.2 + 0.1 − victim dodge", () => {
    // 0.2 + 0.5 − 0.1 = 0.6

    const before = createMatch(makeConfig());
    const { tributes } = before;

    const weaponId = "bow";
    const weapon: WeaponDefinition = weaponDefinitions.find(
      (d) => d.weaponDefinitionId === weaponId,
    )!;
    tributes[0]!.stats.strength = 10;
    tributes[0]!.stats.agility = 5;
    tributes[1]!.stats.agility = 2;

    const chance = hitChance(tributes[0]!, tributes[1]!, weapon);

    expect(chance).toBeCloseTo(0.6);
  });

  test("over 200 attack attempts, for an attacker using a spear of strength 5, and a victim with agility 5, the hit rate is 0.45 within +-0.1 (0.2 + 0.5 - 0.25 = 0.45)", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let spots = 0;
    let hits = 0;

    for (let seed = 0; seed < 200; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.agility = 5;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.strength = 5;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack?.outcome === "hit" || attack?.outcome === "missed") {
        spots++;
        if (attack.outcome === "hit") {
          hits++;
        }
      }
    }

    const chance = hits / spots;
    expect(chance).toBeGreaterThanOrEqual(0.45 - 0.1);
    expect(chance).toBeLessThanOrEqual(0.45 + 0.1);
  });

  test("hitChance when unarmed scales with strength", () => {
    // 0.2 + 0.5 − 0.25 = 0.45

    const before = createMatch(makeConfig());
    const { tributes } = before;

    const weaponId = "unarmed";
    const weapon: WeaponDefinition = weaponDefinitions.find(
      (d) => d.weaponDefinitionId === weaponId,
    )!;

    tributes[0]!.stats.strength = 5;
    tributes[1]!.stats.agility = 5;

    const chance = hitChance(tributes[0]!, tributes[1]!, weapon);

    expect(chance).toBeCloseTo(0.45);
  });

  test("for a spear of power 24, an attacker strength of 5, and a victim endurance of 5, the damage will be 32", () => {
    // (24 + 10 − floor(2.5) = 32)

    const before = createMatch(makeConfig());
    const { tributes } = before;

    const weaponId = "spear";
    const weapon: WeaponDefinition = weaponDefinitions.find(
      (d) => d.weaponDefinitionId === weaponId,
    )!;
    tributes[0]!.stats.strength = 5;
    tributes[1]!.stats.endurance = 5;

    const damageDone = damage(tributes[0]!, tributes[1]!, weapon);

    expect(damageDone).toBe(32);
  });

  test("for a weak weapon of power -40, and a victim endurance of 5, the damage will be capped to a minimum of 1", () => {
    // (-40 + 0 − floor(2.5) = -42 -> 1)

    const before = createMatch(makeConfig());
    const { tributes } = before;

    tributes[0]!.stats.strength = 0;
    tributes[1]!.stats.endurance = 5;

    const weapon: WeaponDefinition = {
      // Weak weapon so that the minimum damage bounds are reached
      weaponDefinitionId: "weakWeapon",
      name: "WeakWeapon",
      power: -40,
      foragingBonus: 0,
      scalesWith: "strength",
      startingAmmunition: null,
      ranged: false,
    };

    const damageDone = damage(tributes[0]!, tributes[1]!, weapon);

    expect(damageDone).toBe(1);
  });

  test("on hit: victim HP falls by the damage, TributeHealthChanged has delta: -32 and the new hp", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "forage" },
      t3: { type: "rest" },
    };

    let hits = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.stats.endurance = 5;
      before.tributes[1]!.hp = 50;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.stats.strength = 5;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack?.outcome === "hit") {
        hits++;

        expect(events).toContainEqual(
          expect.objectContaining({
            type: "TributeHealthChanged",
            tributeId: "t2",
            delta: -32,
            hp: 18,
          }),
        );
      }
    }

    expect(hits).toBeGreaterThan(0);
  });

  test("on miss: no TributeHealthChanged for the victim", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hide" },
      t3: { type: "rest" },
    };

    let misses = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.hp = 50;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack?.outcome === "missed") {
        misses++;

        expect(events).not.toContainEqual(
          expect.objectContaining({
            type: "TributeHealthChanged",
            tributeId: "t2",
          }),
        );
      }
    }

    expect(misses).toBeGreaterThan(0);
  });

  test("damage scales with the weapon's stat: a bow uses agility, not strength", () => {
    // 28 + 2 - floor(2.5) = 28

    const before = createMatch(makeConfig());
    const { tributes } = before;

    const weaponId = "bow";
    tributes[0]!.stats.strength = 10;
    tributes[0]!.stats.agility = 1;
    tributes[1]!.stats.agility = 2;
    tributes[1]!.stats.endurance = 5;

    const weapon: WeaponDefinition = weaponDefinitions.find(
      (d) => d.weaponDefinitionId === weaponId,
    )!;

    const damageDone = damage(tributes[0]!, tributes[1]!, weapon);

    expect(damageDone).toBe(28);
  });

  test("a hunt emits exactly one TributeAttacked, whether it hits or misses", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let misses = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.hp = 50;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { events } = resolveRound(before, actions);

      const t1Attacks = filterEvents(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      expect(t1Attacks).toHaveLength(1);

      if (t1Attacks[0]?.outcome === "missed") {
        misses++;
      }
    }

    expect(misses).toBeGreaterThan(0);
  });

  // Death
  // - when a tribute dies from being attacked, the killerId is set and correct
  // - when a tribute dies, the killer gains their weapon and the rest of the ammunition
  // - when a tribute dies, their later action is skipped
  // - when a tribute dies, their hp ends at 0, with alive: false
  // - two-way hunts: if the first victim survives, both attacks happen. If the first hit kills, the second never happens

  test("when a tribute dies from being attacked, the killerId is set and correct", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let hits = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.hp = 1;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack?.outcome === "hit") {
        hits++;
        expect(events).toContainEqual(
          expect.objectContaining({
            type: "TributeDied",
            victimId: "t2",
            cause: {
              kind: "attack",
              killerId: "t1",
            },
          }),
        );
      }
    }

    expect(hits).toBeGreaterThan(0);
  });

  test("when a tribute dies, the killer gains their weapon and the rest of the ammunition", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let hits = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.hp = 1;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];
      before.tributes[1]!.inventory = [
        {
          definitionId: "bow",
          ammunition: 2,
          kind: "weapon",
          itemId: "b2",
        },
      ];

      const { state: after, events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack?.outcome === "hit") {
        hits++;
        expect(events).toContainEqual(
          expect.objectContaining({
            type: "TributeDied",
            victimId: "t2",
            cause: {
              kind: "attack",
              killerId: "t1",
            },
          }),
        );
        expect(after.tributes[0]!.inventory).toContainEqual(
          expect.objectContaining({
            definitionId: "bow",
            ammunition: 2,
            kind: "weapon",
            itemId: "b2",
          }),
        );
        expect(after.tributes[1]!.inventory).toEqual([]);
        expect(events).toContainEqual(
          expect.objectContaining({
            type: "TributeGainedItem",
            tributeId: "t1",
            item: {
              definitionId: "bow",
              ammunition: 2,
              kind: "weapon",
              itemId: "b2",
            },
          }),
        );
      }
    }

    expect(hits).toBeGreaterThan(0);
  });

  test("when a tribute dies, their later action is skipped", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let deadlyAttacks = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.position = "forest";
      before.tributes[1]!.stats.intelligence = 1;
      before.tributes[1]!.stats.agility = 1;
      before.tributes[1]!.hp = 20;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.stats.agility = 10;
      before.tributes[0]!.stats.strength = 10;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.hp = 80;
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (
        attack?.outcome === "hit" &&
        findEvent(events, "TributeDied", (e) => e.victimId === "t2")
      ) {
        deadlyAttacks++;
        expect(events).not.toContainEqual(
          expect.objectContaining({
            type: "TributeRested",
            tributeId: "t1",
          }),
        );
      }
    }

    expect(deadlyAttacks).toBeGreaterThan(0);
  });

  test("when a tribute dies, their hp ends at 0, with alive: false", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let hits = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.hp = 1;
      before.tributes[1]!.position = "forest";
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { state: after, events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (attack?.outcome === "hit") {
        hits++;
        expect(events).toContainEqual(
          expect.objectContaining({
            type: "TributeDied",
            victimId: "t2",
            cause: {
              kind: "attack",
              killerId: "t1",
            },
          }),
        );
        expect(after.tributes[1]!.alive).toBe(false);
        expect(after.tributes[1]!.hp).toBe(0);
      }
    }

    expect(hits).toBeGreaterThan(0);
  });

  test("two-way hunts: if the first victim survives a melee attack, both attacks happen", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hunt", targetId: "t1" },
      t3: { type: "rest" },
    };

    let undeadlyAttacks = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.position = "forest";
      before.tributes[1]!.stats.intelligence = 1;
      before.tributes[1]!.stats.agility = 1;
      before.tributes[1]!.hp = 80;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.stats.agility = 10;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.hp = 80;
      before.tributes[0]!.inventory = [];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (
        attack?.outcome === "hit" &&
        !findEvent(events, "TributeDied", (e) => e.victimId === "t2")
      ) {
        undeadlyAttacks++;
        expect(events).toContainEqual(
          expect.objectContaining({
            type: "TributeAttacked",
            attackerId: "t2",
            victimId: "t1",
          }),
        );
        const attack = findEvent(
          events,
          "TributeAttacked",
          (e) => e.attackerId === "t2",
        );
        expect(attack?.outcome).toBeOneOf(["hit", "missed"]);
      }
    }

    expect(undeadlyAttacks).toBeGreaterThan(0);
  });

  test("two-way hunts: if the first hit kills, the second never happens", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hunt", targetId: "t1" },
      t3: { type: "rest" },
    };

    let deadlyAttacks = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.position = "forest";
      before.tributes[1]!.stats.intelligence = 1;
      before.tributes[1]!.stats.agility = 1;
      before.tributes[1]!.hp = 20;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.stats.agility = 10;
      before.tributes[0]!.stats.strength = 10;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.hp = 80;
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (
        attack?.outcome === "hit" &&
        findEvent(events, "TributeDied", (e) => e.victimId === "t2")
      ) {
        deadlyAttacks++;
        expect(events).not.toContainEqual(
          expect.objectContaining({
            type: "TributeAttacked",
            attackerId: "t2",
            victimId: "t1",
          }),
        );
      }
    }

    expect(deadlyAttacks).toBeGreaterThan(0);
  });

  test("a kill adds 1 to the killer's kills", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let kills = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.position = "forest";
      before.tributes[1]!.stats.agility = 1;
      before.tributes[1]!.hp = 10;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.stats.agility = 10;
      before.tributes[0]!.stats.strength = 10;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];
      before.tributes[0]!.kills = 3;

      const { state: after, events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (
        attack?.outcome === "hit" &&
        findEvent(events, "TributeDied", (e) => e.victimId === "t2")
      ) {
        kills++;
        expect(after.tributes[0]!.kills).toBe(before.tributes[0]!.kills + 1);
      }
    }

    expect(kills).toBeGreaterThan(0);
  });

  test("an attack death sets diedInRound", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let kills = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.position = "forest";
      before.tributes[1]!.stats.agility = 1;
      before.tributes[1]!.hp = 10;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.stats.agility = 10;
      before.tributes[0]!.stats.strength = 10;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];
      before.tributes[0]!.kills = 3;
      before.round = 6;

      const { state: after, events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      if (
        attack?.outcome === "hit" &&
        findEvent(events, "TributeDied", (e) => e.victimId === "t2")
      ) {
        kills++;
        expect(after.tributes[1]!.diedInRound).toBe(after.round);
      }
    }

    expect(kills).toBeGreaterThan(0);
  });

  test("a hunger death sets diedInRound", () => {
    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig({ seed: 0 }));
    before.tributes[0]!.hp = 1;
    before.tributes[0]!.hunger = 100;
    before.round = 6;

    const { state: after } = resolveRound(before, actions);

    expect(after.tributes[0]!.diedInRound).toBe(after.round);

  });

  test("a hunger death doesn't give anyone a kill", () => {
    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    const before = createMatch(makeConfig({ seed: 0 }));
    before.tributes[0]!.hp = 1;
    before.tributes[0]!.hunger = 100;
    before.tributes[0]!.kills = 1;
    before.tributes[1]!.kills = 3;
    before.tributes[2]!.kills = 4;
    before.round = 6;

    const { state: after } = resolveRound(before, actions);

    expect(after.tributes[0]!.kills).toBe(before.tributes[0]!.kills);
    expect(after.tributes[1]!.kills).toBe(before.tributes[1]!.kills);
    expect(after.tributes[2]!.kills).toBe(before.tributes[2]!.kills);
  })

  // Events
  // - each outcome emits the right events in the right order

  test("a ranged kill (bow) emits, in seq order: TributeAttacked → TributeAmmunitionChanged → TributeHealthChanged → TributeDied → TributeGainedItem", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    };

    let deadlyAttacks = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = createMatch(makeConfig({ seed }));
      before.tributes[1]!.position = "forest";
      before.tributes[1]!.stats.agility = 1;
      before.tributes[1]!.hp = 20;
      before.tributes[0]!.stats.intelligence = 10;
      before.tributes[0]!.stats.agility = 10;
      before.tributes[0]!.stats.strength = 10;
      before.tributes[0]!.position = "forest";
      before.tributes[0]!.hp = 80;
      before.tributes[0]!.inventory = [
        {
          definitionId: "bow",
          ammunition: 3,
          kind: "weapon",
          itemId: "b1",
        },
      ];
      before.tributes[1]!.inventory = [
        {
          definitionId: "spear",
          ammunition: null,
          kind: "weapon",
          itemId: "b1",
        },
      ];

      const { events } = resolveRound(before, actions);

      const attack = findEvent(
        events,
        "TributeAttacked",
        (e) => e.attackerId === "t1",
      );

      // TributeAttacked → TributeAmmunitionChanged →
      // TributeHealthChanged → TributeDied → TributeGainedItem
      if (attack?.outcome === "hit") {
        deadlyAttacks++;

        const start = events.indexOf(attack);
        expect(events.slice(start, start + 5).map((e) => e.type)).toEqual([
          "TributeAttacked",
          "TributeAmmunitionChanged",
          "TributeHealthChanged",
          "TributeDied",
          "TributeGainedItem",
        ]);
      }
    }

    expect(deadlyAttacks).toBeGreaterThan(0);
  });

  test.each<{
    outcome: string;
    actions: RoundActions;
    arrange: (state: GameState) => void;
  }>([
    {
      outcome: "targetGone",
      actions: {
        t1: { type: "hunt", targetId: "t2" },
        t2: { type: "rest" },
        t3: { type: "rest" },
      },
      arrange: (state: GameState) => {
        state.tributes[1]!.position = "centre";
      },
    },
    {
      outcome: "notFound",
      actions: {
        t1: { type: "hunt", targetId: "t2" },
        t2: { type: "hide" },
        t3: { type: "rest" },
      },
      arrange: (state: GameState) => {
        state.tributes[1]!.stats.stealth = 10;
        state.tributes[1]!.stats.intelligence = 10;
      },
    },
    {
      outcome: "pinnedDown",
      actions: {
        t1: { type: "hunt", targetId: "t2" },
        t2: { type: "hunt", targetId: "t1" },
        t3: { type: "rest" },
      },
      arrange: (state: GameState) => {
        state.tributes[1]!.stats.stealth = 10;
        state.tributes[1]!.stats.intelligence = 10;
        state.tributes[1]!.inventory = [
          {
            definitionId: "bow",
            ammunition: 3,
            kind: "weapon",
            itemId: "b1",
          },
        ];
      },
    },
  ])(
    "$outcome: t1's attack emits only TributeAttacked",
    ({ outcome, actions, arrange }) => {
      let matches = 0;
      for (let seed = 0; seed < 20; seed++) {
        const before = createMatch(makeConfig({ seed }));
        before.tributes[1]!.position = "forest";
        before.tributes[0]!.position = "forest";
        before.tributes[0]!.inventory = [
          {
            definitionId: "bow",
            ammunition: 3,
            kind: "weapon",
            itemId: "b1",
          },
        ];
        arrange(before);
        const { events } = resolveRound(before, actions);

        const attack = findEvent(
          events,
          "TributeAttacked",
          (e) => e.attackerId === "t1",
        );
        if (attack?.outcome !== outcome) continue;
        matches++;

        expect(
          filterEvents(
            events,
            "TributeHealthChanged",
            (e) => e.tributeId === "t2" && e.delta < 0,
          ),
        ).toEqual([]);
        expect(events).not.toContainEqual(
          expect.objectContaining({ type: "TributeDied", tributeId: "t2" }),
        );
        expect(events).not.toContainEqual(
          expect.objectContaining({
            type: "TributeGainedItem",
            tributeId: "t1",
          }),
        );
        expect(events).not.toContainEqual(
          expect.objectContaining({
            type: "TributeAmmunitionChanged",
            tributeId: "t1",
          }),
        );
      }

      expect(matches).toBeGreaterThan(0);
    },
  );

  // Safety
  // - the input state is unchanged, and determinism holds

  function arrangeBusyRound(seed: number) {
    const before = createMatch(makeConfig({ seed }));
    before.tributes[0]!.position = "forest";
    before.tributes[0]!.inventory = [
      {
        definitionId: "bow",
        ammunition: 3,
        kind: "weapon",
        itemId: "b1",
      },
    ];
    before.tributes[1]!.position = "forest";
    before.tributes[1]!.inventory = [
      {
        definitionId: "spear",
        ammunition: null,
        kind: "weapon",
        itemId: "b2",
      },
    ];
    before.tributes[1]!.hp = 1;
    before.tributes[2]!.position = "forest";
    return before;
  }

  test("the input state is unchanged", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hunt", targetId: "t1" },
      t3: { type: "hide" },
    };

    let tributeDiedEvents = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = arrangeBusyRound(seed);

      const snapshot = structuredClone(before);

      const { events } = resolveRound(before, actions);

      expect(before).toEqual(snapshot);

      if (findEvent(events, "TributeDied")) {
        tributeDiedEvents++;
      }
    }

    expect(tributeDiedEvents).toBeGreaterThan(0);
  });

  test("determinism holds", () => {
    const actions: RoundActions = {
      t1: { type: "hunt", targetId: "t2" },
      t2: { type: "hunt", targetId: "t1" },
      t3: { type: "hide" },
    };

    let tributeDiedEvents = 0;

    for (let seed = 0; seed < 20; seed++) {
      const before = arrangeBusyRound(seed);

      const snapshot = structuredClone(before);

      const { state: after, events } = resolveRound(before, actions);
      const { state: afterClone, events: cloneEvents } = resolveRound(
        snapshot,
        actions,
      );

      if (findEvent(events, "TributeDied")) {
        tributeDiedEvents++;
      }

      expect(after).toEqual(afterClone);
      expect(events).toEqual(cloneEvents);
    }

    expect(tributeDiedEvents).toBeGreaterThan(0);
  });
});
