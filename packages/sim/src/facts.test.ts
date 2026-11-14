import { describe, expect, test } from "vitest";
import { ev, makeConfig } from "./testFixtures";
import type {
  GameEvent,
  TributeAttacked,
  TributeChangedZone,
  TributeDied,
  TributeForaged,
  TributeRested,
} from "@arena/shared";
import { witnessed, type UnseenAttack, type WitnessedEvent } from "./witnessed";
import { buildFacts } from "./facts";
import { createMatch } from "./createMatch";

// Facts
// - two melee hits from t4 → attackedYou: 2, lastAttackedYou is the later round
// - a ranged hit → no attack entry for the attacker
// - t4 is seen dying → the death fact is set
// - lastSeen is the most recent event involving t4
// - a tribute with no events → no entry at all
// - no zero values: a tribute you've only seen resting has no attackedYou key

describe("facts", () => {
  test("two melee hits from t4 → attackedYou: 2, lastAttackedYou is the later round", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t1",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        1,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t1",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        20,
        3,
      ) as TributeAttacked,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();

    expect(facts["t4"]!.attackedYou).toEqual(2);

    expect(facts["t4"]!.lastAttackedYou).toEqual(3);
  });

  test("a ranged hit → no attack entry for the attacker", () => {
    const match = createMatch(makeConfig());

    const events: GameEvent[] = [
      ev({
        type: "TributeAttacked",
        attackerId: "t4",
        victimId: "t1",
        location: "centre",
        outcome: "hit",
        weaponDefinitionId: "bow",
      }) as TributeAttacked,
    ];

    const facts = buildFacts(witnessed(match, events, "t1"), "t1");

    expect(facts).toEqual({});

    expect(facts["t4"]).toBeUndefined();
  });

  test("t4 is seen dying → the death fact is set", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeDied",
          victimId: "t4",
          location: "centre",
          cause: { kind: "hunger" },
        },
        10,
        2,
      ) as TributeDied,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.diedRound).toEqual(2);
  });

  test("lastSeen is the most recent event involving t4", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t1",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        1,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeForaged",
          tributeId: "t4",
          location: "centre",
          success: true,
        },
        20,
        3,
      ) as TributeForaged,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.lastSeen).toEqual({ position: "centre", round: 3 });
  });

  test("a tribute with no events → no entry at all", () => {
    const events: WitnessedEvent[] = [];

    const facts = buildFacts(events, "t1");

    expect(facts).toEqual({});
  });

  test("no zero values: a tribute you've only seen resting has no attackedYou key", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeRested",
          tributeId: "t4",
          location: "centre",
        },
        20,
        3,
      ) as TributeRested,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.attackedYou).toBeUndefined();
  });

  test("a tribute seen changing zone -> heading value of currentZoneId", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeChangedZone",
          tributeId: "t4",
          previousZoneId: "river",
          currentZoneId: "centre",
          location: "river",
        },
        20,
        3,
      ) as TributeChangedZone,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.heading).toEqual("centre");
  });

  test("observed a tribute killing 3 times -> killed equal to 3 and contains valid victims", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeDied",
          victimId: "t2",
          location: "centre",
          cause: { kind: "attack", killerId: "t4" },
        },
        10,
        2,
      ) as TributeDied,
      ev(
        {
          type: "TributeDied",
          victimId: "t3",
          location: "centre",
          cause: { kind: "attack", killerId: "t4" },
        },
        10,
        3,
      ) as TributeDied,
      ev(
        {
          type: "TributeDied",
          victimId: "t5",
          location: "centre",
          cause: { kind: "attack", killerId: "t4" },
        },
        10,
        4,
      ) as TributeDied,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.killed).toEqual(["t2", "t3", "t5"]);
  });

  test("observed a tribute attacking 3 times -> attacked equal to 3 and contains valid victims", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t2",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        1,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t3",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        2,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t5",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        3,
      ) as TributeAttacked,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.attacked).toEqual(["t2", "t3", "t5"]);
  });

  test("seen a tribute attacking with different weapons -> weaponsSeen equal to 2 and contains valid weapons", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t2",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        1,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t3",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "bow",
        },
        2,
        2,
      ) as TributeAttacked,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.weaponsSeen).toEqual(["crowbar", "bow"]);
  });

  test("a move, then a rest -> no heading", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeChangedZone",
          tributeId: "t4",
          previousZoneId: "river",
          currentZoneId: "centre",
          location: "river",
        },
        20,
        3,
      ) as TributeChangedZone,
      ev(
        {
          type: "TributeRested",
          tributeId: "t4",
          location: "centre",
        },
        30,
        5,
      ) as TributeRested,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.heading).toBeUndefined();
  });

  test("attacks does not include attackedYou: an attack on the observer counts in attackedYou, not in attacked", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t2",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        1,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t1",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        1,
      ) as TributeAttacked,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.attackedYou).toEqual(1);
    expect(facts["t4"]!.attacked!.length).toEqual(1);
    expect(facts["t4"]!.attacked).toEqual(["t2"]);
  });

  test("attacked t4 2 times -> youAttacked equal to 2, youLastAttacked is the later round", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t1",
          victimId: "t4",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        1,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t1",
          victimId: "t4",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        10,
        2,
      ) as TributeAttacked,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.youAttacked).toEqual(2);
    expect(facts["t4"]!.youLastAttacked).toEqual(2);
  });

  test("duplicates: t4 hits t2 twice -> attacked: ['t2'], not two entries", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t2",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        2,
        1,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t2",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        7,
        2,
      ) as TributeAttacked,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.attacked).toEqual(["t2"]);
  });

  test("unarmed: weaponDefinitionId: null -> no weaponsSeen entry", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t4",
          victimId: "t2",
          location: "centre",
          outcome: "hit",
          weaponDefinitionId: null,
        },
        2,
        1,
      ) as TributeAttacked,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts["t4"]).toBeDefined();
    expect(facts["t4"]!.weaponsSeen).toBeUndefined();
  });

  test("the observer never gets an entry about itself: t1 rests -> facts is {}", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeRested",
          tributeId: "t1",
          location: "river",
        },
        30,
        5,
      ) as TributeRested,
    ];

    const facts = buildFacts(events, "t1");

    expect(facts).toEqual({});
    expect(facts["t1"]).toBeUndefined();
  });
});
