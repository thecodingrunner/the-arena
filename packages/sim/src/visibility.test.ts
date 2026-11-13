// Visibility
// alive and in the event's zone -> true
// alive but in another zone -> false
// dead and in the event's zone -> false

import { describe, expect, test } from "vitest";
import { canSee } from "./visibility";

describe("visibility", () => {
  test("alive and in the event's zone -> true", () => {
    const observer = { position: "forest", alive: true };

    const canSeeEvent = canSee(observer, "forest");

    expect(canSeeEvent).toBe(true);
  });

  test("alive but in another zone -> false", () => {
    const observer = { position: "forest", alive: true };

    const canSeeEvent = canSee(observer, "river");

    expect(canSeeEvent).toBe(false);
  });

  test("dead and in the event's zone -> false", () => {
    const observer = { position: "forest", alive: false };

    const canSeeEvent = canSee(observer, "forest");

    expect(canSeeEvent).toBe(false);
  });
});
