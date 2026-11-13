import { describe, expect, test } from "vitest";
import { makePerception } from "./testFixtures";
import type { Perception } from "@arena/shared";
import { FALLBACK_FORAGE_HUNGER, fallbackAction } from "./fallback";

// Fallback
// - Given hunger ≥ FALLBACK_FORAGE_HUNGER and the zone has food, the fallback returns forage, even when tributes are visible (forage wins over hide).
// - Given hunger < FALLBACK_FORAGE_HUNGER and tributes are visible in the current zone, the fallback returns hide
// - Given hunger ≥ FALLBACK_FORAGE_HUNGER, zone has water but no food, the fallback returns forage, even when tributes are visible (forage wins over hide).
// - Given hunger ≥ FALLBACK_FORAGE_HUNGER, zone has no food or water, and tributes are visible, the fallback returns hide.
// - Given hunger < FALLBACK_FORAGE_HUNGER, no tributes visible in current zone, the fallback returns rest.
// - across all the scenarios above, the fallback's action type is always one of forage, hide or rest.
// - hunger exactly at threshold -> forage
// - one below threshold -> not forage

describe("fallback", () => {
  function perceptionWithHunger(
    hunger: number,
    overrides: Partial<Perception> = {},
  ) {
    const base = makePerception(overrides);
    return { ...base, self: { ...base.self, hunger } };
  }

  test("Given hunger ≥ FALLBACK_FORAGE_HUNGER and the zone has food, the fallback returns forage, even when tributes are visible (forage wins over hide).", () => {
    const perception = perceptionWithHunger(90);

    const action = fallbackAction(perception);

    expect(action.type).toBe("forage");
  });

  test("hunger exactly at threshold -> forage: Given hunger === FALLBACK_FORAGE_HUNGER and the zone has food, the fallback returns forage, even when tributes are visible (forage wins over hide).", () => {
    const perception = perceptionWithHunger(FALLBACK_FORAGE_HUNGER);

    const action = fallbackAction(perception);

    expect(action.type).toBe("forage");
  });

  test("one below threshold -> not forage: Given hunger === FALLBACK_FORAGE_HUNGER - 1 and tributes are visible in the current zone, the fallback returns hide.", () => {
    const perception = perceptionWithHunger(FALLBACK_FORAGE_HUNGER - 1);

    const action = fallbackAction(perception);

    expect(action.type).toBe("hide");
  });

  test("Given hunger < FALLBACK_FORAGE_HUNGER and tributes are visible in the current zone, the fallback returns hide.", () => {
    const perception = perceptionWithHunger(30);

    const action = fallbackAction(perception);

    expect(action.type).toBe("hide");
  });

  test("Given hunger ≥ FALLBACK_FORAGE_HUNGER, zone has water but no food, the fallback returns forage, even when tributes are visible (forage wins over hide).", () => {
    const perception = perceptionWithHunger(90, {
      zone: { zoneId: "forest", food: 0, water: 2, cover: 2 },
    });

    const action = fallbackAction(perception);

    expect(action.type).toBe("forage");
  });

  test("Given hunger ≥ FALLBACK_FORAGE_HUNGER, zone has no food or water, and tributes are visible, the fallback returns hide.", () => {
    const perception = perceptionWithHunger(90, {
      zone: { zoneId: "forest", food: 0, water: 0, cover: 2 },
    });

    const action = fallbackAction(perception);

    expect(action.type).toBe("hide");
  });

  test("Given hunger < FALLBACK_FORAGE_HUNGER, no tributes visible in current zone, the fallback returns rest.", () => {
    const perception = perceptionWithHunger(30, { visibleTributes: [] });

    const action = fallbackAction(perception);

    expect(action.type).toBe("rest");
  });

  test("across all the scenarios above, the fallback's action type is always one of forage, hide or rest.", () => {
    const hungers = [
      30,
      FALLBACK_FORAGE_HUNGER - 1,
      FALLBACK_FORAGE_HUNGER,
      90,
    ];

    const zoneOverrides = [
      { zone: { zoneId: "forest", food: 0, water: 0, cover: 2 } },
      { zone: { zoneId: "forest", food: 0, water: 2, cover: 2 } },
      { zone: { zoneId: "forest", food: 2, water: 0, cover: 2 } },
    ];

    const visibleTributeOverrides = [
      { visibleTributes: [] },
      {
        visibleTributes: [
          { tributeId: "t2", name: "Tribute Two", hidLastRound: false },
        ],
      },
    ];

    for (let hunger of hungers) {
      for (let visibleTributeOverride of visibleTributeOverrides) {
        for (let zoneOverride of zoneOverrides) {
          const override = { ...visibleTributeOverride, ...zoneOverride };
          const perception = perceptionWithHunger(hunger, override);
          const action = fallbackAction(perception);
          expect(
            ["forage", "hide", "rest"],
            `hunger ${hunger}, ${JSON.stringify(override)}`,
          ).toContain(action.type);
        }
      }
    }
  });
});
