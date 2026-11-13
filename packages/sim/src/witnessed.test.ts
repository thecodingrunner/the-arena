// t1 moves river → forest before t4 attacks t2 in river in the same round. witnessed(t1) doesn't include the attack, and witnessed(t2) includes it exactly once.
// Arrivals aren't witnessed: t2 moves into t1's zone. t1 doesn't see that TributeChangedZone, because its location is t2's origin.
// Dead observers see nothing more: after t1's TributeDied, later public events in t1's old zone aren't included.
// t1 hides, then sees an attack in its zone, and the attack appears exactly once.

import { beforeEach, describe, expect, test } from "vitest";
import { createMatch } from "./createMatch";
import { makeConfig } from "./testFixtures";
import { witnessed } from "./witnessed";
import type {
  GameEvent,
  TributeAttacked,
  TributeChangedZone,
  TributeDied,
  TributeForaged,
  TributeHid,
  TributeRested,
} from "@arena/shared";

describe("witnessed", () => {
  let seq = 0;
  function ev<E extends GameEvent>(
    e: Omit<E, "matchId" | "seq" | "round" | "v">,
  ): E {
    return { matchId: "match-1", seq: seq++, round: 1, v: 1, ...e } as E;
  }
  beforeEach(() => {
    seq = 0;
  });

  test("t1 moves river → centre before t2 attacks t3 in river in the same round. witnessed(t1) doesn't include the attack, and witnessed(t3) includes it exactly once.", () => {
    const before = createMatch(makeConfig());

    before.tributes[0]!.position = "river";
    before.tributes[1]!.position = "river";
    before.tributes[2]!.position = "river";

    const events: GameEvent[] = [
      ev({
        type: "TributeChangedZone",
        tributeId: "t1",
        previousZoneId: "river",
        currentZoneId: "centre",
        location: "river",
      }) as TributeChangedZone,
      ev({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t3",
        location: "river",
        outcome: "hit",
        weaponDefinitionId: "bow",
      }) as TributeAttacked,
    ];

    const witnessedT1 = witnessed(before, events, "t1");
    const witnessedT3 = witnessed(before, events, "t3");

    expect(witnessedT1).not.toContainEqual(
      expect.objectContaining({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t3",
      }),
    );
    expect(witnessedT3).toContainEqual(
      expect.objectContaining({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t3",
      }),
    );

    expect(witnessedT3.map((e) => e.type)).toEqual([
      "TributeChangedZone",
      "TributeAttacked",
    ]);
  });

  test("Arrivals aren't witnessed: t2 moves into t1's zone. t1 doesn't see that TributeChangedZone, because its location is t2's origin.", () => {
    const before = createMatch(makeConfig());
    before.tributes[0]!.position = "centre";

    const events: GameEvent[] = [
      ev({
        type: "TributeChangedZone",
        tributeId: "t2",
        previousZoneId: "river",
        currentZoneId: "centre",
        location: "river",
      }) as TributeChangedZone,
      ev({
        type: "TributeRested",
        tributeId: "t3",
        location: "centre",
      }) as TributeRested,
    ];

    const witnessedT1 = witnessed(before, events, "t1");

    expect(witnessedT1).not.toContainEqual(
      expect.objectContaining({ type: "TributeChangedZone", tributeId: "t2" }),
    );

    expect(witnessedT1).toContainEqual(
      expect.objectContaining({ type: "TributeRested", tributeId: "t3" }),
    );
  });

  test("Dead observers see nothing more: after t1's TributeDied, later public events in t1's old zone aren't included.", () => {
    const before = createMatch(makeConfig());

    before.tributes[0]!.position = "centre";
    before.tributes[1]!.position = "centre";
    before.tributes[2]!.position = "centre";

    const events: GameEvent[] = [
      ev({
        type: "TributeForaged",
        tributeId: "t2",
        location: "centre",
        success: true,
      }) as TributeForaged,
      ev({
        type: "TributeDied",
        victimId: "t1",
        location: "centre",
        cause: { kind: "hunger" },
      }) as TributeDied,
      ev({
        type: "TributeAttacked",
        attackerId: "t3",
        victimId: "t2",
        location: "centre",
        outcome: "hit",
        weaponDefinitionId: "bow",
      }) as TributeAttacked,
    ];

    const witnessedT1 = witnessed(before, events, "t1");

    expect(witnessedT1).toContainEqual(
      expect.objectContaining({ type: "TributeForaged", tributeId: "t2" }),
    );

    expect(witnessedT1).toContainEqual(
      expect.objectContaining({ type: "TributeDied", victimId: "t1" }),
    );

    expect(witnessedT1).not.toContainEqual(
      expect.objectContaining({
        type: "TributeAttacked",
        attackerId: "t3",
        victimId: "t2",
      }),
    );
  });

  test("t1 hides, then sees an attack in its zone, and the attack appears exactly once.", () => {
    const before = createMatch(makeConfig());

    before.tributes[0]!.position = "centre";
    before.tributes[1]!.position = "centre";
    before.tributes[2]!.position = "centre";

    const events: GameEvent[] = [
      ev({
        type: "TributeHid",
        tributeId: "t1",
        location: "centre",
      }) as TributeHid,
      ev({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t3",
        location: "centre",
        outcome: "hit",
        weaponDefinitionId: "bow",
      }) as TributeAttacked,
      ev({
        type: "TributeRested",
        tributeId: "t3",
        location: "centre",
      }) as TributeRested,
    ];

    const witnessedT1 = witnessed(before, events, "t1");

    expect(witnessedT1.map((e) => e.type)).toEqual([
      "TributeHid",
      "TributeAttacked",
      "TributeRested",
    ]);

    expect(
      witnessedT1.filter((e) => e.type === "TributeAttacked"),
    ).toHaveLength(1);

    expect(witnessedT1).toContainEqual(
      expect.objectContaining({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t3",
      }),
    );
  });

  test("throws if the tribute does not exist in state.tributes", () => {
    const state = createMatch(makeConfig());
    expect(() => witnessed(state, [], "t5")).toThrow(
      "tribute t5 is not in state.tributes",
    );
  });

  test("witnessed does not modify state", () => {
    const before = createMatch(makeConfig());
    before.tributes[0]!.position = "river";

    const snapshot = structuredClone(before);
    const events: GameEvent[] = [
      ev({
        type: "TributeChangedZone",
        tributeId: "t1",
        previousZoneId: "river",
        currentZoneId: "centre",
        location: "river",
      }) as TributeChangedZone,
      ev({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t3",
        location: "centre",
        outcome: "hit",
        weaponDefinitionId: "bow",
      }) as TributeAttacked,
      ev({
        type: "TributeRested",
        tributeId: "t3",
        location: "centre",
      }) as TributeRested,
    ];

    const witnessedT1 = witnessed(before, events, "t1");

    expect(snapshot).toEqual(before);
  });

  test("a tribute can witness its own move", () => {
    const before = createMatch(makeConfig());

    before.tributes[0]!.position = "river";

    const events: GameEvent[] = [
      ev({
        type: "TributeChangedZone",
        tributeId: "t1",
        previousZoneId: "river",
        currentZoneId: "centre",
        location: "river",
      }) as TributeChangedZone,
    ];

    const witnessedT1 = witnessed(before, events, "t1");

    expect(witnessedT1).toContainEqual(
      expect.objectContaining({ type: "TributeChangedZone", tributeId: "t1" }),
    );
  });
});
