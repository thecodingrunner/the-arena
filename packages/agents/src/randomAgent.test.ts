// The random agent
// - hunt target is in visibleTributes
// - a move_to target is in adjacentZoneIds
// - the random agent cannot select hunt if its perceive input has an empty visibleTributes field
// - the random agent cannot select move_to if there are no adjacent zones
// - over many seeds, each possible action type shows up at least once
// - the same agent seed and the same perception give the same action

import { test, describe, expect } from "vitest";
import { makePerception } from "./testFixtures";
import { randomAgent } from "./randomAgent";
import { createRng } from "@arena/sim";
import type { Action } from "@arena/shared";

describe("randomAgent", () => {
  test("when hunt is selected, the hunt target is in visibleTributes, and all visibleTributes are selected at least once", () => {
    const perception = makePerception({
      visibleTributes: [
        { tributeId: "t3", name: "t3", hidLastRound: false },
        { tributeId: "t5", name: "t5", hidLastRound: false },
        { tributeId: "t7", name: "t7", hidLastRound: false },
      ],
    });

    let hunts = 0;
    const selectedHuntTarget = new Set<string>();

    for (let seed = 0; seed < 200; seed++) {
      const action = randomAgent(perception, createRng(seed));

      if (action.type === "hunt") {
        hunts++;
        expect(perception.visibleTributes.map((t) => t.tributeId)).toContain(
          action.targetId,
        );
        selectedHuntTarget.add(action.targetId);
      }
    }

    expect(hunts).toBeGreaterThan(0);
    expect([...selectedHuntTarget].sort()).toEqual(
      perception.visibleTributes.map((t) => t.tributeId).sort(),
    );
  });

  test("a move_to target is in adjacentZoneIds, and all adjacentZoneIds are selected at least once", () => {
    const perception = makePerception({
      adjacentZoneIds: ["zoneA", "zoneB"],
    });

    let moves = 0;
    const selectedMoveTarget = new Set<string>();

    for (let seed = 0; seed < 200; seed++) {
      const action = randomAgent(perception, createRng(seed));

      if (action.type === "move_to") {
        moves++;
        expect(perception.adjacentZoneIds).toContain(action.zoneId);
        selectedMoveTarget.add(action.zoneId);
      }
    }

    expect(moves).toBeGreaterThan(0);
    expect([...selectedMoveTarget].sort()).toEqual(
      perception.adjacentZoneIds.sort(),
    );
  });

  test("the random agent cannot select hunt if its perceive input has an empty visibleTributes field", () => {
    const perception = makePerception({
      visibleTributes: [],
    });

    const possibleActions: Action["type"][] = [
      "forage",
      "hide",
      "rest",
      "move_to",
    ];
    const completedActions: Action["type"][] = [];

    for (let seed = 0; seed < 200; seed++) {
      const action = randomAgent(perception, createRng(seed));
      expect(action.type).not.toEqual("hunt");
      if (!completedActions.includes(action.type)) {
        completedActions.push(action.type);
      }
    }

    expect(completedActions.sort()).toEqual(possibleActions.sort());
  });

  test("the random agent cannot select move_to if there are no adjacent zones", () => {
    const perception = makePerception({
      adjacentZoneIds: [],
    });

    const possibleActions: Action["type"][] = [
      "forage",
      "hide",
      "rest",
      "hunt",
    ];
    const completedActions: Action["type"][] = [];

    for (let seed = 0; seed < 200; seed++) {
      const action = randomAgent(perception, createRng(seed));
      expect(action.type).not.toEqual("move_to");
      if (!completedActions.includes(action.type)) {
        completedActions.push(action.type);
      }
    }

    expect(completedActions.sort()).toEqual(possibleActions.sort());
  });

  test("over many seeds, each possible action type shows up at least once", () => {
    const perception = makePerception({});

    const possibleActions: Action["type"][] = [
      "forage",
      "hide",
      "rest",
      "hunt",
      "move_to",
    ];
    const completedActions: Action["type"][] = [];

    for (let seed = 0; seed < 200; seed++) {
      const action = randomAgent(perception, createRng(seed));

      if (!completedActions.includes(action.type)) {
        completedActions.push(action.type);
      }
    }

    expect(completedActions.sort()).toEqual(possibleActions.sort());
  });

  test("the same agent seed and the same perception give the same action", () => {
    const perception = makePerception({});
    const perceptionCopy = structuredClone(perception);

    const action = randomAgent(perception, createRng(1));
    const actionCopy = randomAgent(perceptionCopy, createRng(1));

    expect(action).toEqual(actionCopy);
  });
});
