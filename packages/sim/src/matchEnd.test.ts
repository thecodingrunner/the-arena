// The end check and tie-break

import { describe, expect, test } from "vitest";
import { createMatch } from "./createMatch";
import {
  filterEvents,
  makeConfig,
  makeTributes,
  markDead,
} from "./testFixtures";
import { checkMatchEnd } from "./matchEnd";
import { createRng } from "./rng";
import { MAX_ROUNDS } from "./rules";
import { resolveRound } from "./resolveRound";

describe("matchEnd", () => {
  // The end check
  // - MatchEnded is emitted exactly once, and it's the last event of its round (check seq)
  // - resolveRound throws if called after the match has ended
  // - placements: every tribute appears exactly once, the winner is at index 0, and the earlier deaths are placed lower
  // - if there is one tribute alive, the MatchEnded event will be emitted once with the match results of kind "lastStanding"
  // - if there are more than one tributes alive and the max round limit is reached, the MatchEnded event will be emitted with the match results of kind "tiebreak" and cause "timeout"
  // - if there are 0 alive after the round, the MatchEnded event will be emitted with the match results of kind "tiebreak" and cause "draw"

  test("MatchEnded is emitted exactly once, and it's the last event of its round (check seq)", () => {
    const match = createMatch(makeConfig());
    match.round = MAX_ROUNDS - 1;
    match.seq = 42;

    const { events } = resolveRound(match, {
      t1: { type: "rest" },
      t2: { type: "rest" },
      t3: { type: "rest" },
    });

    const matchEndedEvents = filterEvents(events, "MatchEnded");

    const maxSeq = Math.max(...events.map((e) => e.seq));

    expect(matchEndedEvents.length).toBe(1);

    expect(matchEndedEvents[0]!.seq).toBe(maxSeq);
  });

  test("resolveRound throws if called after the match has ended", () => {
    const match = createMatch(makeConfig());
    match.result = {
      kind: "lastStanding",
      rounds: MAX_ROUNDS,
      winnerId: "t1",
      placements: ["t1", "t2", "t3"],
    };

    expect(() => {
      resolveRound(match, {
        t1: { type: "rest" },
        t2: { type: "rest" },
        t3: { type: "rest" },
      });
    }).toThrow("The match has already ended");
  });

  test("placements: every tribute appears exactly once, the winner is at index 0, and the earlier deaths are placed lower", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(3) }));
    markDead(match, 1, 1);
    markDead(match, 2, 2);
    match.round = 3;

    const matchResult = checkMatchEnd(
      match.round,
      { t1: 80, t2: 0, t3: 0 },
      match.tributes,
      createRng(0),
    );

    expect(matchResult).not.toBeNull();
    expect(matchResult!.placements).toEqual(["t1", "t3", "t2"]);
  });

  test("if there is one tribute alive, the MatchEnded event will be emitted once with the match results of kind 'lastStanding'", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(2) }));
    match.round = 3;
    markDead(match, 1, 1);

    const { events } = resolveRound(match, {
      t1: { type: "rest" },
      t2: { type: "rest" },
    });

    const matchEndedEvents = filterEvents(events, "MatchEnded");

    expect(matchEndedEvents.length).toBe(1);
    expect(matchEndedEvents[0]!.result.kind).toBe("lastStanding");
  });

  test("if there are more than one tributes alive and the max round limit is reached, the MatchEnded event will be emitted with the match results of kind 'tiebreak' and cause 'timeout'", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(2) }));
    match.round = MAX_ROUNDS - 1;

    const { events } = resolveRound(match, {
      t1: { type: "rest" },
      t2: { type: "rest" },
    });

    const matchEndedEvents = filterEvents(events, "MatchEnded");

    expect(matchEndedEvents.length).toBe(1);
    expect(matchEndedEvents[0]!.result).toMatchObject({
      kind: "tiebreak",
      cause: "timeout",
    });
  });

  test("if there are 0 alive after the round, the MatchEnded event will be emitted with the match results of kind 'tiebreak' and cause 'draw'", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(2) }));
    match.tributes[0]!.hp = 1;
    match.tributes[1]!.hp = 1;
    match.tributes[0]!.hunger = 100;
    match.tributes[1]!.hunger = 100;

    const { events } = resolveRound(match, {
      t1: { type: "hide" },
      t2: { type: "hide" },
    });

    const matchEndedEvents = filterEvents(events, "MatchEnded");

    expect(matchEndedEvents.length).toBe(1);
    expect(matchEndedEvents[0]!.result).toMatchObject({
      kind: "tiebreak",
      cause: "draw",
    });
  });

  test("boundary twin: starting at MAX_ROUNDS - 2 gives no MatchEnded", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(2) }));
    match.round = MAX_ROUNDS - 2;

    const { events } = resolveRound(match, {
      t1: { type: "rest" },
      t2: { type: "rest" },
    });

    expect(events).not.toContainEqual(expect.objectContaining({ type: "MatchEnded" }));
  });

  // The tie-break
  // - in a tiebreak ending, the tribute with the greater hp at the start of the round will win
  // - in a tiebreak ending, with both tributes of equal hp at the start of the round, the tribute with the most kills will win
  // - in a tiebreak ending, with both tributes of equal hp and kills, higher endurance wins more often, but the lower one still wins sometimes
  // - two or more alive and below the cap returns null

  test("in a tiebreak ending, the tribute with the greater hp at the start of the round will win", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(3) }));
    markDead(match, 2, 1);
    const startHp = { t1: 100, t2: 50 };
    match.round = MAX_ROUNDS;

    const result = checkMatchEnd(
      match.round,
      startHp,
      match.tributes,
      createRng(0),
    );

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      kind: "tiebreak",
      cause: "timeout",
      winnerId: "t1",
      rule: "hp",
      tiedIds: ["t1", "t2"],
    });
  });

  test("in a tiebreak ending, with both tributes of equal hp at the start of the round, the tribute with the most kills will win", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(3) }));
    const startHp = { t1: 100, t2: 100 };
    match.round = MAX_ROUNDS;
    match.tributes[0]!.kills = 1;
    match.tributes[1]!.kills = 2;
    markDead(match, 2, 1);

    const result = checkMatchEnd(
      match.round,
      startHp,
      match.tributes,
      createRng(0),
    );

    expect(result).not.toBeNull();
    expect(result?.winnerId).toBe("t2");
    expect(result).toMatchObject({
      kind: "tiebreak",
      cause: "timeout",
      rule: "kills",
      tiedIds: ["t2", "t1"],
    });
  });

  test("in a tiebreak ending, with both tributes of equal hp and kills, significantly higher endurance always wins", () => {
    // 10 + 1 (min roll) > 1 + 5 (max roll)
    const startHp = { t1: 100, t2: 100 };

    for (let seed = 0; seed < 200; seed++) {
      const match = createMatch(makeConfig({ tributes: makeTributes(2) }));

      match.round = MAX_ROUNDS;
      match.tributes[0]!.kills = 1;
      match.tributes[1]!.kills = 1;
      match.tributes[0]!.stats.endurance = 1;
      match.tributes[1]!.stats.endurance = 10;

      const result = checkMatchEnd(
        match.round,
        startHp,
        match.tributes,
        createRng(seed),
      );

      expect(result).not.toBeNull();
      expect(result?.winnerId).toBe("t2");
      expect(result).toMatchObject({
        kind: "tiebreak",
        cause: "timeout",
        rule: "roll",
      });
    }
  });

  test("in a tiebreak ending, with both tributes of equal hp and kills, higher endurance wins more often, but the lower one still wins sometimes", () => {
    const startHp = { t1: 100, t2: 100 };

    let highEnduranceWins = 0;
    let lowEnduranceWins = 0;

    for (let seed = 0; seed < 200; seed++) {
      const match = createMatch(makeConfig({ tributes: makeTributes(2) }));

      match.round = MAX_ROUNDS;
      match.tributes[0]!.kills = 1;
      match.tributes[1]!.kills = 1;
      match.tributes[0]!.stats.endurance = 6;
      match.tributes[1]!.stats.endurance = 5;

      const result = checkMatchEnd(
        match.round,
        startHp,
        match.tributes,
        createRng(seed),
      );

      expect(result).not.toBeNull();

      expect(result).toMatchObject({
        kind: "tiebreak",
        cause: "timeout",
        rule: "roll",
      });

      if (result?.winnerId === "t1") {
        highEnduranceWins++;
      } else if (result?.winnerId === "t2") {
        lowEnduranceWins++;
      }
    }

    expect(highEnduranceWins).toBeGreaterThan(lowEnduranceWins);
    expect(lowEnduranceWins).toBeGreaterThan(0);
  });

  test("two or more alive and below the cap returns null", () => {
    const match = createMatch(makeConfig({ tributes: makeTributes(2) }));
    const startHp = { t1: 100, t2: 50 };

    const result = checkMatchEnd(
      match.round,
      startHp,
      match.tributes,
      createRng(0),
    );

    expect(result).toBeNull();
  });
});
