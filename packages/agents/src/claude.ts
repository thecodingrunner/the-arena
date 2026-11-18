import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { type LlmResponse } from "@arena/shared";
import type { CallModel, ModelResult } from "./modelResult";

const MAX_TOKENS = 3000;
const MODEL_NAME = "claude-haiku-5-5";

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rest") }),
  z.object({ type: z.literal("hide") }),
  z.object({ type: z.literal("forage") }),
  z.object({ type: z.literal("move_to"), zoneId: z.string() }),
  z.object({ type: z.literal("hunt"), targetId: z.string() }),
]);

export const llmResponseSchema = z.object({
  intent: z.string(),
  action: actionSchema,
  tagUpdates: z.array(
    z.object({
      tributeId: z.string(),
      tags: z.array(z.string()),
    }),
  ),
  line: z.string(),
}) satisfies z.ZodType<LlmResponse>;

export function makeClaudeCallModel(client: Anthropic): CallModel {
  return async function callModel(
    system: string,
    user: string,
  ): Promise<ModelResult> {
    let response;
    try {
      response = await client.messages.parse({
        model: MODEL_NAME,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: user,
          },
        ],
        output_config: {
          effort: "low",
          format: zodOutputFormat(llmResponseSchema),
        },
      });
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionTimeoutError) {
        return {
          kind: "failure",
          reason: "timeout",
        };
      }

      if (error instanceof Anthropic.APIConnectionError) {
        return {
          kind: "failure",
          reason: "connection",
        };
      }

      if (error instanceof Anthropic.RateLimitError) {
        return {
          kind: "failure",
          reason: "rateLimit",
        };
      }

      if (error instanceof Anthropic.RequestTimeoutError) {
        return {
          kind: "failure",
          reason: "timeout",
        };
      }

      if (error instanceof Anthropic.InternalServerError) {
        return {
          kind: "failure",
          reason: "serverError",
        };
      }

      throw error;
    }

    switch (response.stop_reason) {
      case "refusal":
        return {
          kind: "failure",
          reason: "refusal",
        };
      case "max_tokens":
        return {
          kind: "failure",
          reason: "maxTokens",
        };
    }

    if (response.parsed_output === null) {
      return {
        kind: "failure",
        reason: "invalidOutput",
      };
    }

    return {
      kind: "reply",
      llmResponse: response.parsed_output,
    };
  };
}
