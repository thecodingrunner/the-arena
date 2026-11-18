import {
    MAX_LINE_LENGTH,
  type AgentDecision,
  type FallbackReason,
  type Memory,
  type Perception,
  type Tags,
  type TributeConfig,
  type TributeId,
} from "@arena/shared";
import type { CallModel } from "./modelResult";
import { buildSystemPrompt, buildUserMessage } from "./prompt";
import { convertTagUpdates } from "./convertTagUpdates";
import { fallbackAction } from "./fallback";

export function makeDecide(
  callModel: CallModel,
  tributes: TributeConfig[],
  names: Record<TributeId, string>,
): (
  perception: Perception,
  memory: Memory,
  tags: Record<TributeId, Tags>,
) => Promise<AgentDecision> {
  return async (perception, memory, tags) => {
    const fallback = (reason: FallbackReason): AgentDecision => ({
      source: "fallback",
      reason: reason,
      action: fallbackAction(perception),
      line: "",
      tagUpdates: {},
    });

    const tribute = tributes.find(
      (tribute) => tribute.tributeId === perception.self.tributeId,
    );
    if (!tribute) {
      throw new Error(`Tribute ${perception.self.tributeId} not found`);
    }
    const system = buildSystemPrompt(tribute);
    const user = buildUserMessage(perception, memory, tags, names);
    const result = await callModel(system, user);

    // schema gate
    if (result.kind === "failure") {
      return fallback(result.reason);
    }

    const action = result.llmResponse.action;

    // game gate

    if (action.type === "hunt") {
      if (
        !perception.visibleTributes.some((t) => t.tributeId === action.targetId)
      ) {
        return fallback("illegalHunt");
      }
    }

    if (action.type === "move_to") {
      if (!perception.adjacentZoneIds.includes(action.zoneId)) {
        return fallback("illegalMove");
      }
    }

    const seenIds = new Set<TributeId>([
      ...perception.visibleTributes.map((t) => t.tributeId),
      ...Object.keys(memory.facts),
    ]);

    return {
      source: "llm",
      action: action,
      line: result.llmResponse.line.slice(0, MAX_LINE_LENGTH),
      tagUpdates: convertTagUpdates(
        result.llmResponse.tagUpdates,
        perception.self.tributeId,
        seenIds,
      ),
    };
  };
}
