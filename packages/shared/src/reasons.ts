export const MODEL_FAILURE_REASONS = [
  "refusal",
  "rateLimit",
  "serverError",
  "timeout",
  "maxTokens",
  "invalidOutput",
  "connection",
] as const;

export const GAME_GATE_REASONS = ["illegalHunt", "illegalMove"] as const;