import type {
  AgentDecision,
  Decide,
  GameEvent,
  MatchConfig,
  Memory,
  SponsorGift,
  Tags,
  TributeId,
} from "@arena/shared";
import { describe, expect, test } from "vitest";
import { makeCliTributes } from "./cliTributes";
import { createMatch, createRng, MAX_ROUNDS, resolveRound } from "@arena/sim";
import { runMatch } from "./matchLoop";
import { makeDecide, makeRandomDecide } from "@arena/agents";

// The loop
// - given an ended state, runMatch throws an error
// - the same seed with recorded decisions produces an identical event log
// - the game runs to completion, exactly one MatchEnded event emitted, never thows, never goes past MAX_ROUNDS
// - exactly one action per living tribute, and none for dead tributes
// - every random match runs to completion at 8 to 24 tributes
// - the replay gives an identical log

describe("matchLoop", () => {
  test("given an ended state, runMatch throws an error", async () => {
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

    await expect(runMatch(state, makeRandomDecide(agentRng))).rejects.toThrow(
      "Match already ended",
    );
  });

  test.each([8, 16, 24])(
    "%i tributes: the same seed with recorded decisions produces an identical event log",
    async (tributeCount) => {
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
        } = await runMatch(state, makeRandomDecide(agentRng));

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

  test("at least some matches end by lastStanding or draw, not all by timeout", async () => {
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
        const { state: finalState } = await runMatch(
          state,
          makeRandomDecide(agentRng),
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

  test("the game runs to completion, exactly one MatchEnded event emitted, never throws, never goes past MAX_ROUNDS (8 to 24 tributes)", async () => {
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
        const { state: finalState, events } = await runMatch(
          state,
          makeRandomDecide(agentRng),
        );

        expect(finalState.result).not.toBe(null);
        expect(finalState.round).toBeLessThanOrEqual(MAX_ROUNDS);
        const matchEndedEvents = events.filter((e) => e.type === "MatchEnded");
        expect(matchEndedEvents).toHaveLength(1);
      }
    }
  });

  test("exactly one action per living tribute, and none for dead tributes", async () => {
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
      const { actions, state: finalState } = await runMatch(
        state,
        makeRandomDecide(agentRng),
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

  // gifts
  test.each([8, 24])(
    "a gift injected from the CLI changes the outcome of later rounds, and never earlier ones",
    async (tributeCount) => {
      let delivered = 0;
      let undelivered = 0;

      for (let seed = 0; seed < 20; seed++) {
        const config: MatchConfig = {
          matchId: "match-1",
          arenaId: "placeholder",
          seed: seed,
          tributes: makeCliTributes(tributeCount),
        };
        const gift: SponsorGift = {
          giftId: "g1",
          from: null,
          to: "t1",
          itemDefinitionId: "medkit",
          appliesInRound: 5,
        };

        const stateWith = createMatch(config);
        stateWith.tributes[0]!.hp = 40;

        const stateWithout = createMatch(config);
        stateWithout.tributes[0]!.hp = 40;

        const agentRngWith = createRng(seed);
        const agentRngWithout = createRng(seed);
        const { state: finalStateWith, events: withGift } = await runMatch(
          stateWith,
          makeRandomDecide(agentRngWith),
          [gift],
        );
        const { state: finalStateWithout, events: without } = await runMatch(
          stateWithout,
          makeRandomDecide(agentRngWithout),
        );

        expect(finalStateWith.result).not.toBe(null);
        expect(finalStateWithout.result).not.toBe(null);

        expect(without.filter((e) => e.round <= 4)).toEqual(
          withGift.filter((e) => e.round <= 4),
        );
        expect(without.filter((e) => e.round > 4)).not.toEqual(
          withGift.filter((e) => e.round > 4),
        );

        const giftEvents = withGift.filter(
          (e) =>
            (e.type === "SponsorGiftDelivered" ||
              e.type === "SponsorGiftUndelivered") &&
            e.giftId === "g1",
        );

        expect(giftEvents).toHaveLength(1);
        const outcome = giftEvents[0]!;
        if (outcome.type === "SponsorGiftDelivered") {
          delivered++;
          // the next event is its health change, with a positive delta
          const next = withGift[withGift.indexOf(outcome) + 1];
          expect(next).toMatchObject({
            type: "TributeHealthChanged",
            tributeId: "t1",
          });
        } else {
          undelivered++;
          expect(outcome).toMatchObject({ reason: "recipientDead" });
        }
      }

      expect(delivered).toBeGreaterThan(0);
      expect(undelivered).toBeGreaterThan(0);
    },
  );

  test("Tags carry over: the tags a decision returns in round N reach decide in round N+1. old tags about other targets survive an update.", async () => {
    const state = createMatch({
      matchId: "match-1",
      arenaId: "placeholder",
      seed: 1,
      tributes: makeCliTributes(8),
    });

    const received: Record<number, Record<TributeId, Tags>> = {};

    const updatesForT1: Record<number, Record<TributeId, Tags>> = {
      1: { t2: ["a", "b"] },
      2: { t3: ["c", "d"] },
    };

    const fakeDecide: Decide = async (perception, _memory, tags) => {
      const id = perception.self.tributeId;
      if (id === "t1") received[perception.round] = tags;

      return {
        source: "llm",
        action: { type: "rest" },
        line: "",
        tagUpdates: id === "t1" ? (updatesForT1[perception.round] ?? {}) : {},
      };
    };

    await runMatch(state, fakeDecide);

    expect(received[2]).toEqual({ t2: ["a", "b"] });
    expect(received[3]).toEqual({ t2: ["a", "b"], t3: ["c", "d"] });
  });

  test("Memory carries over: in round 2, the fake's memory contains a round-1 event it witnessed.", async () => {
    const state = createMatch({
      matchId: "match-1",
      arenaId: "placeholder",
      seed: 1,
      tributes: makeCliTributes(8),
    });

    const memories: Record<number, Memory> = {};

    const fakeDecide: Decide = async (perception, memory, _tags) => {
      if (perception.self.tributeId === "t1")
        memories[perception.round] = memory;

      return {
        source: "llm",
        action: { type: "rest" },
        line: "",
        tagUpdates: {},
      };
    };

    await runMatch(state, fakeDecide);

    expect(memories[2]?.recent).toContainEqual(
      expect.objectContaining({
        type: "TributeRested",
        tributeId: "t1",
        round: 1,
      }),
    );
  });

  test("Decisions are recorded, one record per round, keyed by id.", async () => {
    const state = createMatch({
      matchId: "match-1",
      arenaId: "placeholder",
      seed: 1,
      tributes: makeCliTributes(8),
    });

    const fakeDecide: Decide = async () => ({
      source: "llm",
      action: { type: "rest" },
      line: "",
      tagUpdates: {},
    });

    const {
      decisions,
      actions,
    } = await runMatch(state, fakeDecide);

    expect(decisions).toBeDefined();
    expect(decisions.length).toEqual(actions.length);
    for (const tribute of state.tributes.filter((t) => t.alive)) {
      expect(decisions[0]![tribute.tributeId]).toBeDefined();
    }
    expect(decisions[0]!.t1).toEqual({
      source: "llm",
      action: { type: "rest" },
      line: "",
      tagUpdates: {},
    });
  });

  function makeRecordedDecide(
    decisions: Record<TributeId, AgentDecision>[],
  ): Decide {
    return async (perception) => {
      const id = perception.self.tributeId;
      const decision = decisions[perception.round]?.[id];
      if (!decision)
        throw new Error(`No decision for ${id} in round ${perception.round}`);
      return decision;
    };
  }

  test("Replay: run a match, then run it again with a decide that just returns the recorded decisions. The events should be identical.", async () => {
    const state = createMatch({
      matchId: "match-1",
      arenaId: "placeholder",
      seed: 1,
      tributes: makeCliTributes(8),
    });

    const {
      state: finalState,
      decisions,
      events,
    } = await runMatch(state, makeRandomDecide(createRng(1)));

    const replayState = createMatch({
      matchId: "match-1",
      arenaId: "placeholder",
      seed: 1,
      tributes: makeCliTributes(8),
    });

    const { state: replayFinalState, events: replayEvents } = await runMatch(
      replayState,
      makeRecordedDecide(decisions),
    );

    expect(replayFinalState).toEqual(finalState);
    expect(replayEvents).toEqual(events);
    expect(events).toContainEqual(expect.objectContaining({ type: "TributeDied" }));
  });
});
