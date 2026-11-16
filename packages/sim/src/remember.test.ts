import { describe, expect, test } from "vitest";
import { createMatch } from "./createMatch";
import { ev, makeConfig, makeTributes } from "./testFixtures";
import type {
  MatchConfig,
  TributeAttacked,
  TributeChangedZone,
  TributeForaged,
  TributeHealthChanged,
  TributeRested,
} from "@arena/shared";
import { remember } from "./remember";

describe("remember", () => {
  test("deciding round 10: witnessed events from rounds 7-9 are in recent, and round 6 isn't", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(4) }));

    match.tributes[0]!.position = "river";

    const events = [
      ev(
        {
          type: "TributeChangedZone",
          tributeId: "t1",
          previousZoneId: "river",
          currentZoneId: "centre",
          location: "river",
        },
        20,
        6,
      ) as TributeChangedZone,
      ev(
        {
          type: "TributeRested",
          tributeId: "t2",
          location: "centre",
        },
        25,
        7,
      ) as TributeRested,
      ev(
        {
          type: "TributeForaged",
          tributeId: "t3",
          location: "centre",
          success: true,
        },
        30,
        8,
      ) as TributeForaged,
      ev(
        {
          type: "TributeForaged",
          tributeId: "t4",
          location: "centre",
          success: true,
        },
        35,
        9,
      ) as TributeForaged,
    ];

    const { recent, facts } = remember(match, events, "t1", 10);

    expect(recent).not.toContainEqual(
      expect.objectContaining({
        type: "TributeChangedZone",
        tributeId: "t1",
        previousZoneId: "river",
        currentZoneId: "centre",
        location: "river",
      }),
    );
    expect(recent).toContainEqual(
      expect.objectContaining({
        type: "TributeRested",
        tributeId: "t2",
        location: "centre",
      }),
    );
    expect(recent).toContainEqual(
      expect.objectContaining({
        type: "TributeForaged",
        tributeId: "t3",
        location: "centre",
        success: true,
      }),
    );
    expect(recent).toContainEqual(
      expect.objectContaining({
        type: "TributeForaged",
        tributeId: "t4",
        location: "centre",
        success: true,
      }),
    );
  });

  test("facts cover the whole history even though recent doesn't: facts include an attack from round 2", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(4) }));

    const events = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t2",
          victimId: "t3",
          location: "river",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        7,
        2,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeRested",
          tributeId: "t2",
          location: "river",
        },
        25,
        7,
      ) as TributeRested,
    ];

    match.tributes[0]!.position = "river";

    const { recent, facts } = remember(match, events, "t1", 10);

    expect(facts.t2).toBeDefined();
    expect(facts.t2!.attacked).toEqual(["t3"]);

    expect(recent).not.toContainEqual(
      expect.objectContaining({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t3",
        location: "river",
        outcome: "hit",
        weaponDefinitionId: "crowbar",
      }),
    );

    expect(recent).toContainEqual(
      expect.objectContaining({
        type: "TributeRested",
        tributeId: "t2",
        location: "river",
      }),
    );
  });

  test("an event the tribute didn't witness is in neither, which proves it goes through witnessed", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(4) }));

    match.tributes[0]!.position = "centre";

    const events = [
      ev(
        {
          type: "TributeAttacked",
          attackerId: "t2",
          victimId: "t3",
          location: "river",
          outcome: "hit",
          weaponDefinitionId: "crowbar",
        },
        22,
        7,
      ) as TributeAttacked,
      ev(
        {
          type: "TributeHealthChanged",
          tributeId: "t2",
          location: "centre",
          hp: 50,
          delta: 5,
        },
        25,
        8,
      ) as TributeHealthChanged,
    ];

    const { recent, facts } = remember(match, events, "t1", 10);

    expect(facts).toEqual({});
    expect(recent).toEqual([]);
  });

  test("round 1, with an empty log: { recent: [], facts: {} }", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(4) }));

    const { recent, facts } = remember(match, [], "t1", 1);

    expect(recent).toEqual([]);
    expect(facts).toEqual({});
  });
});
