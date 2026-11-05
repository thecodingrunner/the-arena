import { describe, expect, test } from "vitest";
import { arenaDefinitions } from "./arenas";

// Validates every built-in arena, so new arenas are checked automatically.
test("there is at least one arena (guards against the loop below running zero times)", () => {
  expect(arenaDefinitions.length).toBeGreaterThan(0);
});

describe.each(arenaDefinitions)("arena $arenaId", (arena) => {
  const zoneIds = arena.zones.map((z) => z.zoneId);

  test("has at least one zone", () => {
    expect(arena.zones.length).toBeGreaterThan(0);
  });

  test("zone ids are unique", () => {
    expect(new Set(zoneIds).size).toBe(zoneIds.length);
  });

  test("every edge's from and to is a real zone", () => {
    for (const edge of arena.edges) {
      expect(zoneIds).toContain(edge.from);
      expect(zoneIds).toContain(edge.to);
    }
  });

  test("every edge has a positive cost", () => {
    for (const edge of arena.edges) {
      expect(edge.cost).toBeGreaterThan(0);
    }
  });

  test("has at least one starting zone, and every starting zone is a real zone", () => {
    expect(arena.startingZoneIds.length).toBeGreaterThan(0);
    for (const id of arena.startingZoneIds) {
      expect(zoneIds).toContain(id);
    }
  });

  test("every zone can be reached from every starting zone", () => {
    for (const start of arena.startingZoneIds) {
      const reached = new Set([start]);
      const queue = [start];
      while (queue.length > 0) {
        const current = queue.shift()!; // safe: loop only runs while the queue is non-empty
        for (const edge of arena.edges) {
          if (edge.from === current && !reached.has(edge.to)) {
            reached.add(edge.to);
            queue.push(edge.to);
          }
        }
      }
      expect([...reached].sort()).toEqual([...zoneIds].sort());
    }
  });
});
