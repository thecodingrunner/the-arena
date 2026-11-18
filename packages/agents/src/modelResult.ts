import type { LlmResponse, ModelFailureReason } from "@arena/shared";

export type ModelResult =
  | {
      kind: "reply";
      llmResponse: LlmResponse;
    }
  | {
      kind: "failure";
      reason: ModelFailureReason;
    };

export type CallModel = (system: string, user: string) => Promise<ModelResult>;
