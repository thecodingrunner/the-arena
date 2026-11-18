export const MAX_HP = 100;
export const MAX_HUNGER = 100;
export const STARTING_HP = MAX_HP; // tributes start at full health
export const STARTING_HUNGER = 0;
export const RECENT_ROUNDS = 3;

export const MAX_LINE_LENGTH = 200;

export const HEALTH_PER_REST = 10;
export const HUNGER_VALUE = { food: 30, water: 15 } as const;
export const HUNGER_TICK = 10;
export const HUNGER_HEALTH_COST = 10; // hunger costs health
export const HUNGER_PER_MOVE_COST = 3;