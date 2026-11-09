import {
  arenaDefinitions,
  type GameState,
  type Perception,
  type Tribute,
} from "@arena/shared";

export function perceive(state: GameState, tribute: Tribute): Perception {
  const zone = state.zones.find((z) => z.zoneId === tribute.position);

  if (!zone) throw new Error(`zone ${tribute.position} is not in state.zones`);

  const arena = arenaDefinitions.find((a) => a.arenaId === state.arenaId);

  if (!arena) throw new Error("arena is missing from arenaDefinitions");

  const tributesInSameZone = state.tributes.filter(
    (t) =>
      t.position === tribute.position &&
      t.alive &&
      t.tributeId !== tribute.tributeId,
  );
  const visibleTributes = tributesInSameZone.map((t) => {
    return {
      tributeId: t.tributeId,
      name: t.name,
      hidLastRound: t.hiding,
    };
  });

  const adjacentZoneIds = arena.edges
    .filter((e) => e.from === zone.zoneId)
    .map((e) => e.to);

  return {
    round: state.round,
    self: {
      tributeId: tribute.tributeId,
      hp: tribute.hp,
      hunger: tribute.hunger,
      stats: { ...tribute.stats },
      position: tribute.position,
      inventory: tribute.inventory.map((i) => ({ ...i })),
    },
    zone: {
      zoneId: zone.zoneId,
      food: zone.food,
      water: zone.water,
      cover: zone.cover,
    },
    adjacentZoneIds: adjacentZoneIds, // → valid move_to targets
    visibleTributes: visibleTributes, // same zone, alive, hidLastRound → valid hunt targets
    // later (step 9): recent events this tribute witnessed, memory, relationship tags
  };
}
