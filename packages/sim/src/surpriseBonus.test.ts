import { describe, expect, test } from "vitest";
import { surpriseBonus } from "./resolveRound";
import { SURPRISE_HIT_BONUS } from "./rules";

describe("surpriseBonus", () => {
  test("charisma 10 clamps the bonus to 0", () => {
    const bonus = surpriseBonus(10);

    expect(bonus).toEqual(0);
  });

  test("result never goes below 0", () => {
    for (let i = 0; i < 20; i++) {
      const bonus = surpriseBonus(i);

      expect(bonus).toBeGreaterThanOrEqual(0);
    }
  });

  test("charisma 0 gives SURPRISE_HIT_BONUS", () => {
    const bonus = surpriseBonus(0);

    expect(bonus).toEqual(SURPRISE_HIT_BONUS);
  });
});
