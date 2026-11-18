export const MODEL_FAILURE_REASONS = [
  "refusal",
  "rateLimit",
  "apiError",
  "timeout",
  "maxTokens",
] as const;

export const GAME_GATE_REASONS = ["illegalHunt", "illegalMove"] as const;