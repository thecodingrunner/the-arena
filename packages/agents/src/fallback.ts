import type { Action, Perception } from "@arena/shared";

export const FALLBACK_FORAGE_HUNGER = 60;

export function fallbackAction(perception: Perception): Action {
    if (perception.self.hunger >= FALLBACK_FORAGE_HUNGER && (perception.zone.food > 0 || perception.zone.water > 0)) {
        return { type: "forage" };
    } else if (perception.visibleTributes.length > 0) {
        return { type: "hide" };
    } else {
        return { type: "rest" };
    }
    
}