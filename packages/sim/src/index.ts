// Public entry point for the simulation engine.
// Keep this package free of framework dependencies (no React, Next, LLM SDKs).
export { createRng } from "./rng";
export { createMatch } from "./createMatch";
export { resolveRound } from "./resolveRound";
export { perceive } from "./perceive";