import {
  type Memory,
  type Tags,
  type TributeConfig,
  type TributeId,
  type AgentDecision,
  MODEL_FAILURE_REASONS,
  MAX_LINE_LENGTH,
} from "@arena/shared";
import { describe, expect, test } from "vitest";
import { makeDecide } from "./decide";
import {
  failureWith,
  makePerception,
  makeTributeConfig,
  replyWith,
} from "./testFixtures";
import { fallbackAction } from "./fallback";
import type { CallModel } from "./modelResult";

describe("decide", () => {
  const names = { t1: "Kael", t2: "Tribute Two" };
  const tributes: TributeConfig[] = [makeTributeConfig()];
  const memory: Memory = { recent: [], facts: {} };
  const tags: Record<TributeId, Tags> = {};

  test.each(MODEL_FAILURE_REASONS.map((reason) => ({ reason })))(
    "ModelResult failure '$reason' -> fallback action with reason '$reason'",
    async ({ reason }) => {
      const callModel: CallModel = async () => failureWith(reason);
      const decide = makeDecide(callModel, tributes, names);
      const perception = makePerception();

      const decision = await decide(perception, memory, tags);

      const expected: AgentDecision = {
        source: "fallback",
        reason: reason,
        action: fallbackAction(perception),
        line: "",
        tagUpdates: {},
      };

      expect(decision).toEqual(expected);
    },
  );

  // Game Gate
  test("illegal hunt -> fallback action with reason 'illegalHunt' with no line or tagUpdates", async () => {
    const callModel: CallModel = async () =>
      replyWith({
        intent: "hunt",
        action: {
          type: "hunt",
          targetId: "t6",
        },
        tagUpdates: [{ tributeId: "t2", tags: ["a", "b"] }],
      });
    const decide = makeDecide(callModel, tributes, names);
    const perception = makePerception();

    const decision = await decide(perception, memory, tags);

    const expected: AgentDecision = {
      source: "fallback",
      reason: "illegalHunt",
      action: fallbackAction(perception),
      line: "",
      tagUpdates: {},
    };

    expect(decision).toEqual(expected);
  });

  test("illegal move -> fallback action with reason 'illegalMove' with no line or tagUpdates", async () => {
    const callModel: CallModel = async () =>
      replyWith({
        intent: "move",
        action: {
          type: "move_to",
          zoneId: "somewhere",
        },
        tagUpdates: [{ tributeId: "t2", tags: ["a", "b"] }],
      });
    const decide = makeDecide(callModel, tributes, names);
    const perception = makePerception();

    const decision = await decide(perception, memory, tags);

    const expected: AgentDecision = {
      source: "fallback",
      reason: "illegalMove",
      action: fallbackAction(perception),
      line: "",
      tagUpdates: {},
    };

    expect(decision).toEqual(expected);
  });

  test("line is too long -> same response with line truncated", async () => {
    const callModel: CallModel = async () =>
      replyWith({
        line: "a".repeat(1000),
      });
    const decide = makeDecide(callModel, tributes, names);
    const perception = makePerception();

    const decision = await decide(perception, memory, tags);

    const expected: AgentDecision = {
      source: "llm",
      action: {
        type: "rest",
      },
      line: "a".repeat(MAX_LINE_LENGTH),
      tagUpdates: {},
    };

    expect(decision).toEqual(expected);
  });

  test.todo(
    "line leak (normalised overlap check) -> same response with empty line",
    async () => {
      const callModel: CallModel = async () =>
        replyWith({
          line: "Cautious and observant. And I want to rest",
        });
      const decide = makeDecide(callModel, tributes, names);
      const perception = makePerception();

      const decision = await decide(perception, memory, tags);

      const expected: AgentDecision = {
        source: "llm",
        action: {
          type: "rest",
        },
        line: "",
        tagUpdates: {},
      };

      expect(decision).toEqual(expected);
    },
  );

  test("the same tributeId twice in tagUpdates -> last one wins", async () => {
    const callModel: CallModel = async () =>
      replyWith({
        tagUpdates: [
          { tributeId: "t2", tags: ["a", "b"] },
          { tributeId: "t2", tags: ["c", "d"] },
        ],
      });
    const decide = makeDecide(callModel, tributes, names);
    const perception = makePerception();

    const decision = await decide(perception, memory, tags);

    const expected: AgentDecision = {
      source: "llm",
      action: {
        type: "rest",
      },
      line: "I'll wait here.",
      tagUpdates: { t2: ["c", "d"] },
    };

    expect(decision).toEqual(expected);
  });

  test("a valid reply -> source: 'llm' with action, line and converted tags passed through", async () => {
    const callModel: CallModel = async () => replyWith({});
    const decide = makeDecide(callModel, tributes, names);
    const perception = makePerception();

    const decision = await decide(perception, memory, tags);

    const expected: AgentDecision = {
      source: "llm",
      action: {
        type: "rest",
      },
      line: "I'll wait here.",
      tagUpdates: {},
    };

    expect(decision).toEqual(expected);
  });

  test("a valid hunt on t2 -> source: 'llm' with action, line and converted tags passed through", async () => {
    const callModel: CallModel = async () =>
      replyWith({
        intent: "I want to hunt",
        action: {
          type: "hunt",
          targetId: "t2",
        },
        tagUpdates: [{ tributeId: "t2", tags: ["a", "b"] }],
        line: "I want to hunt",
      });

    const decide = makeDecide(callModel, tributes, names);
    const perception = makePerception();

    const decision = await decide(perception, memory, tags);

    const expected: AgentDecision = {
      source: "llm",
      action: {
        type: "hunt",
        targetId: "t2",
      },
      line: "I want to hunt",
      tagUpdates: { t2: ["a", "b"] },
    };

    expect(decision).toEqual(expected);
  });

  test("perception.self.tributeId isn't in tributes, so it throws", async () => {
    const callModel: CallModel = async () => replyWith({});

    const decide = makeDecide(callModel, tributes, names);
    const perception = makePerception({
      self: {
        ...makePerception().self,
        tributeId: "t3",
      },
    });

    await expect(() => decide(perception, memory, tags)).rejects.toThrow("t3");
  });

  test("the system contains the personality and user contains Round 1.", async () => {
    let received: { system: string; user: string } | undefined;

    const callModel: CallModel = async (system, user) => {
      received = { system, user };
      return replyWith();
    };
    
    const kael = makeTributeConfig(); // t1, "Cautious and observant."
    const mara = makeTributeConfig({
      tributeId: "t2",
      name: "Mara",
      personality: "Bold and reckless.",
    });

    const perception = makePerception({
      self: { ...makePerception().self, tributeId: "t2" },
    });

    const decide = makeDecide(callModel, [kael, mara], names);
    await decide(perception, memory, tags);

    expect(received?.system).toContain(mara.personality);
    expect(received?.system).not.toContain(kael.personality);
    expect(received?.user).toContain("Round 1.");
  });

  test("the fake throws a TypeError, so decide rejects.", async () => {
    const callModel: CallModel = async () => {
      throw new TypeError("bug in the adapter");
    };

    const decide = makeDecide(callModel, [makeTributeConfig()], names);

    await expect(decide(makePerception(), memory, tags)).rejects.toThrow(
      TypeError,
    );
  });

  // Alliances

  test.todo("proposing to a visible tribute who already has an ally -> illegalProposal");

  test.todo("proposing while you already have an ally -> illegalProposal");

  test.todo("proposing to someone who isn't visible -> illegalProposal");

  test.todo("accepting from someone with no offer waiting for you -> illegalAccept");

  test.todo("betraying someone who isn't your ally, or isn't visible -> illegalBetray");

  test.todo("hunting your ally -> illegalHunt");

  test.todo("a valid accept passes through with source 'llm'");

  test.todo("a valid proposal passes through with source 'llm'");

  test.todo("a valid betray passes through with source 'llm'");
});
