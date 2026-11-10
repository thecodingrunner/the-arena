import type { GameEvent, MatchConfig } from "@arena/shared";
import { describe, expect, test } from "vitest";
import { makeCliTributes } from "./cliTributes";
import { createMatch, createRng, resolveRound } from "@arena/sim";
import { runMatch } from "./matchLoop";
import { randomAgent } from "@arena/agents";
import { MAX_ROUNDS } from "@arena/sim/src/rules";

// The loop
// - given an ended state, runMatch throws an error
// - the same seed with recorded decisions produces an identical event log
// - the game runs to completion, exactly one MatchEnded event emitted, never thows, never goes past MAX_ROUNDS
// - exactly one action per living tribute, and none for dead tributes
// - every random match runs to completion at 8 to 24 tributes
// - the replay gives an identical log

describe("matchLoop", () => {
  test("given an ended state, runMatch throws an error", () => {
    const state = createMatch({
      matchId: "match-1",
      arenaId: "placeholder",
      seed: 42,
      tributes: makeCliTributes(8),
    });

    state.result = {
      kind: "lastStanding",
      winnerId: "t1",
      placements: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"],
      rounds: 10,
    };

    const agentRng = createRng(0);

    expect(() => runMatch(state, (p) => randomAgent(p, agentRng))).toThrow(
      "Match already ended",
    );
  });

  test.each([8, 16, 24])(
    "%i tributes: the same seed with recorded decisions produces an identical event log",
    (tributeCount) => {
      for (let seed = 0; seed < 5; seed++) {
        const config: MatchConfig = {
          matchId: "match-1",
          arenaId: "placeholder",
          seed: seed,
          tributes: makeCliTributes(tributeCount),
        };

        const state = createMatch(config);
        const copiedState = createMatch(config);

        const agentRng = createRng(seed);
        const {
          state: finalState,
          actions,
          events,
        } = runMatch(state, (p) => randomAgent(p, agentRng));

        const replayEvents: GameEvent[] = [];
        let replayState = copiedState;
        for (const roundActions of actions) {
          const { state, events: roundEvents } = resolveRound(
            replayState,
            roundActions,
          );
          replayState = state;
          replayEvents.push(...roundEvents);
        }

        expect(events).toContainEqual(
          expect.objectContaining({ type: "TributeAttacked" }),
        );
        expect(events).toContainEqual(
          expect.objectContaining({ type: "TributeDied" }),
        );

        expect(events).toEqual(replayEvents);
        expect(finalState).toEqual(replayState);
        expect(actions.length).toBeGreaterThan(1);
      }
    },
  );

  test("at least some matches end by lastStanding or draw, not all by timeout", () => {
    let endedByLastStanding = 0;
    let endedByDraw = 0;

    for (let seed = 0; seed < 5; seed++) {
      for (let tributeCount = 8; tributeCount < 25; tributeCount++) {
        const config: MatchConfig = {
          matchId: "match-1",
          arenaId: "placeholder",
          seed: seed,
          tributes: makeCliTributes(tributeCount),
        };

        const state = createMatch(config);

        const agentRng = createRng(seed);
        const { state: finalState } = runMatch(state, (p) =>
          randomAgent(p, agentRng),
        );

        if (finalState.result?.kind === "lastStanding") {
          endedByLastStanding++;
        } else if (
          finalState.result?.kind === "tiebreak" &&
          finalState.result.cause === "draw"
        ) {
          endedByDraw++;
        }
      }

      expect(endedByLastStanding).toBeGreaterThan(0);
      expect(endedByDraw).toBeGreaterThan(0);
    }
  });

  test("the game runs to completion, exactly one MatchEnded event emitted, never throws, never goes past MAX_ROUNDS (8 to 24 tributes)", () => {
    for (let seed = 0; seed < 5; seed++) {
      for (let tributeCount = 8; tributeCount < 25; tributeCount++) {
        const config: MatchConfig = {
          matchId: "match-1",
          arenaId: "placeholder",
          seed: seed,
          tributes: makeCliTributes(tributeCount),
        };

        const state = createMatch(config);

        const agentRng = createRng(seed);
        const { state: finalState, events } = runMatch(state, (p) =>
          randomAgent(p, agentRng),
        );

        expect(finalState.result).not.toBe(null);
        expect(finalState.round).toBeLessThanOrEqual(MAX_ROUNDS);
        const matchEndedEvents = events.filter((e) => e.type === "MatchEnded");
        expect(matchEndedEvents).toHaveLength(1);
      }
    }
  });

  test("exactly one action per living tribute, and none for dead tributes", () => {
    let deathsOccured = 0;

    for (let i = 8; i <= 24; i++) {
      const config: MatchConfig = {
        matchId: "match-1",
        arenaId: "placeholder",
        seed: i,
        tributes: makeCliTributes(i),
      };

      const state = createMatch(config);
      const agentRng = createRng(0);
      const { actions, state: finalState } = runMatch(state, (p) =>
        randomAgent(p, agentRng),
      );

      for (let k = 0; k < actions.length; k++) {
        const round = k + 1;
        const expected = finalState.tributes
          .filter((t) => t.diedInRound === null || t.diedInRound >= round)
          .map((t) => t.tributeId)
          .sort();
        expect(Object.keys(actions[k]!).sort()).toEqual(expected);
        if (expected.length < finalState.tributes.length) {
          deathsOccured++;
        }
      }
    }

    expect(deathsOccured).toBeGreaterThan(0);
  });
});
