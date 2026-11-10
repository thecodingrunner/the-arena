// Perceive
// - perceive only returns visibleTributes located in the same zone as the tribute (no tributes from other zones)
// - no personality prompts of other tributes
// - perceive only returns adjacentZones accessible from the current zone
// - if a tribute from visibleTributes was hiding the previous round, it will have a true hidLastRound value
// - perceive returns a Perceive object with the correct round number
// - the tribute itself isn't in visibleTributes
// - dead tributes arent in visibleTributes
// - perceive doesn't modify the state

import { describe, expect, test } from "vitest";
import { makeConfig, makeTribute } from "./testFixtures";
import { createMatch } from "./createMatch";
import { perceive } from "./perceive";
import type { WeaponInstance } from "@arena/shared";

describe("perceive", () => {
  test("perceive only returns visibleTributes located in the same zone as the tribute (no tributes from other zones)", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    before.tributes[0]!.position = "forest";
    before.tributes[1]!.position = "forest";
    before.tributes[2]!.position = "centre";

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.visibleTributes).toHaveLength(1);
    expect(perception.visibleTributes[0]!.tributeId).toEqual("t2");
  });

  test("a visible tribute's personality prompt never appears in the perception", () => {
    const before = createMatch(
      makeConfig({
        tributes: [
          makeTribute({ tributeId: "t1" }),
          makeTribute({ tributeId: "t2", personality: "SECRET-PROMPT-t2" }),
        ],
      }),
    );
    before.tributes[0]!.position = "forest";
    before.tributes[1]!.position = "forest";

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.visibleTributes.map((t) => t.tributeId)).toContain("t2");
    expect(JSON.stringify(perception)).not.toContain("SECRET-PROMPT-t2");
  });

  test("perceive only returns adjacentZones accessible from the current zone", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    before.tributes[0]!.position = "forest";

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.adjacentZoneIds).toHaveLength(2);
    expect(perception.adjacentZoneIds).toContain("centre");
    expect(perception.adjacentZoneIds).toContain("ridge");
    expect(perception.adjacentZoneIds).not.toContain("river");
    expect(perception.adjacentZoneIds).not.toContain("forest");
  });

  test("if a tribute from visibleTributes was hiding the previous round, it will have a true hidLastRound value", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    before.tributes[0]!.position = "forest";
    before.tributes[1]!.position = "forest";
    before.tributes[2]!.position = "centre";
    before.tributes[1]!.hiding = true;

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.visibleTributes).toHaveLength(1);
    expect(perception.visibleTributes[0]!.tributeId).toEqual("t2");
    expect(perception.visibleTributes[0]!.hidLastRound).toBe(true);
  });

  test("if a tribute from visibleTributes wasn't hiding the previous round, it will have a false hidLastRound value", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    before.tributes[0]!.position = "forest";
    before.tributes[1]!.position = "forest";
    before.tributes[1]!.hiding = false;
    before.tributes[2]!.position = "centre";

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.visibleTributes).toHaveLength(1);
    expect(perception.visibleTributes[0]!.tributeId).toEqual("t2");
    expect(perception.visibleTributes[0]!.hidLastRound).toBe(false);
  });

  test("perceive returns a Perceive object with the correct round number", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    before.round = 7;

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.round).toBe(7);
  });

  test("the tribute itself isn't in visibleTributes", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    before.tributes[0]!.position = "forest";
    before.tributes[1]!.position = "forest";
    before.tributes[2]!.position = "centre";

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.visibleTributes).toHaveLength(1);
    expect(perception.visibleTributes[0]!.tributeId).toEqual("t2");
    expect(perception.visibleTributes.map((t) => t.tributeId)).not.toContain(
      "t1",
    );
  });

  test("dead tributes arent in visibleTributes", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    before.tributes[1]!.hp = 0;
    before.tributes[1]!.alive = false;
    before.tributes[0]!.position = "forest";
    before.tributes[1]!.position = "forest";
    before.tributes[2]!.position = "forest";
    before.tributes[2]!.alive = true;

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.visibleTributes).toHaveLength(1);
    expect(perception.visibleTributes[0]!.tributeId).toEqual("t3");
    expect(perception.visibleTributes.map((t) => t.tributeId)).not.toContain(
      "t2",
    );
  });

  test("perceive doesn't modify the state", () => {
    const before = createMatch(makeConfig({ seed: 1 }));
    const snapshot = structuredClone(before);

    perceive(before, before.tributes[0]!);

    expect(before).toEqual(snapshot);
  });

  test("the perception shot tribute contains the same stats, hp, hunger, positon, tributeId and inventory as the tribute", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.self.tributeId).toEqual(before.tributes[0]!.tributeId);
    expect(perception.self.hp).toEqual(before.tributes[0]!.hp);
    expect(perception.self.hunger).toEqual(before.tributes[0]!.hunger);
    expect(perception.self.stats).toEqual(before.tributes[0]!.stats);
    expect(perception.self.position).toEqual(before.tributes[0]!.position);
    expect(perception.self.inventory).toEqual(before.tributes[0]!.inventory);
  });

  test("the perception shot zone contains the same zoneId, food, water and cover as the zone the tribute is currently in", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    const zone = before.zones.find(
      (z) => z.zoneId === before.tributes[0]!.position,
    )!;

    const perception = perceive(before, before.tributes[0]!);

    expect(perception.zone.zoneId).toEqual(zone.zoneId);
    expect(perception.zone.food).toEqual(zone.food);
    expect(perception.zone.water).toEqual(zone.water);
    expect(perception.zone.cover).toEqual(zone.cover);
  });

  test("perceive doesn't assign state objects to the fields", () => {
    const before = createMatch(makeConfig({ seed: 1 }));

    before.tributes[0]!.inventory = [
      {
        itemId: "s1",
        ammunition: 2,
        kind: "weapon",
        definitionId: "bow",
      },
    ];

    const snapshot = structuredClone(before);

    const perception = perceive(before, before.tributes[0]!);

    perception.self.stats.strength = 0;
    (perception.self.inventory[0]! as WeaponInstance).ammunition = 0;
    perception.zone.food = 0;

    expect(before).toEqual(snapshot);
  });
});
