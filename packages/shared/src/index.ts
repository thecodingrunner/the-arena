// Types and static game data shared between sim, agents and the web client.
export type * from "./types";
export { arenaDefinitions } from "./arenas";
export { weaponDefinitions } from "./weapons";
export { sponsorItemDefinitions } from "./sponsorItems";
export { sanitisePersonality } from "./sanitisePersonality";
export { MAX_HP, MAX_HUNGER, STARTING_HP, STARTING_HUNGER, RECENT_ROUNDS } from "./rules";
