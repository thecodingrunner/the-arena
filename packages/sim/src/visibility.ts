import type { ZoneId } from "@arena/shared";

// observer can see what happens in a zone if they're alive and standing in it
export function canSee(
  observer: { position: ZoneId; alive: boolean },
  eventZone: ZoneId,
): boolean {
  return observer.alive && observer.position === eventZone;
}
