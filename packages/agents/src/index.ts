// Prompt building, response schema, LLM client and fallback actions.
// Produces decisions for the engine; never resolves outcomes itself.
export { randomAgent, makeRandomDecide } from "./randomAgent";
export { fallbackAction } from "./fallback";
export { FALLBACK_FORAGE_HUNGER } from "./fallback";
export { makeDecide } from "./decide";
export { makeClaudeCallModel } from "./claude";
