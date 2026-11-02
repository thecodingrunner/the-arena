import { describe, expect, test } from "vitest";
import { createRng, type Rng } from "./rng";

describe("createRng", () => {
  test("the same seed produces the same sequence", () => {
    expect(take(createRng(0), 10)).toEqual(take(createRng(0), 10));
  });

  test("the sequence produced varies from call to call", () => {
    expectSequenceVaries(createRng(0));
  });

  test("every value in the sequence is in [0, 1)", () => {
    expectSequenceInBounds(createRng(0));
  });

  test("seed 42 produces a fixed, recorded sequence", () => {
    expect(take(createRng(42), 5)).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
      0.6697340414393693, 0.17481389874592423,
    ]);
  });

  test("the value returned after 6000000 calls is 0.1574329542927444 (matches the reference mulberry32)", () => {
    const rng = createRng(42);
    for (let i = 0; i < 6000000; i++) {
      rng.next();
    }
    expect(rng.next()).toBe(0.1574329542927444);
  });

  test("different seed produces different sequence", () => {
    expect(take(createRng(1), 10)).not.toEqual(take(createRng(2), 10));
  });

  test("negative seed produces a sequence that's values vary between calls and stays in [0, 1)", () => {
    expectWellBehaved(createRng(-1));
  });

  test("seed of 0 produces a sequence that's values vary between calls and stays in [0, 1)", () => {
    expectWellBehaved(createRng(0));
  });

  test("decimal seed rounds to nearest integer and produces a valid sequence: createRng(1.5) produces the same sequence as createRng(2)", () => {
    expect(take(createRng(1.5), 10)).toEqual(take(createRng(2), 10));
  });

  test("seed of NaN throws an error", () => {
    expect(() => createRng(NaN)).toThrow("The seed needs to be a valid number");
  });

  test("seed of Infinity throws an error", () => {
    expect(() => createRng(Infinity)).toThrow(
      "The seed needs to be a valid number",
    );
  });

  test("seed of -Infinity throws an error", () => {
    expect(() => createRng(-Infinity)).toThrow(
      "The seed needs to be a valid number",
    );
  });
});

describe("rng.int", () => {
  test("rng.int(min, max) returns a whole number", () => {
    const arr = takeInt(createRng(0), 1000);

    expect(arr.every((val) => Number.isInteger(val))).toEqual(true);
  });

  test("rng.int(min, max) never returns a value outside [min, max]", () => {
    const arr = takeInt(createRng(0), 1000);

    expect(Math.max(...arr)).toBeLessThanOrEqual(3);
    expect(Math.min(...arr)).toBeGreaterThanOrEqual(1);
  });

  test("when 1000 calls are made to rng.int(1, 3), all numbers in {1, 2, 3} are returned", () => {
    const arr = takeInt(createRng(0), 1000);
    const set = new Set(arr);
    expect(set).toEqual(new Set([1, 2, 3]));
  });

  test("when rng.int(min, max) contains a negative value (-2, 2), every value from min and max is reachable", () => {
    const arr = takeInt(createRng(0), 1000, -2, 2);
    const set = new Set(arr);
    expect(set).toEqual(new Set([-2, -1, 0, 1, 2]));
  });

  test("when min is bigger than max, an error is thrown", () => {
    expect(() => createRng(0).int(2, 1)).toThrow(
      "min needs to be less than or equal to max",
    );
  });

  test("when min is equal to max, the same number is returned every time", () => {
    const arr = takeInt(createRng(0), 1000, 2, 2);
    const set = new Set(arr);
    expect(set).toEqual(new Set([2]));
  });

  test("when min or max is decimal, an error is thrown", () => {
    expect(() => createRng(0).int(1.5, 2)).toThrow(
      "min and max need to be whole numbers",
    );
    expect(() => createRng(0).int(1, 2.5)).toThrow(
      "min and max need to be whole numbers",
    );
  });

  test("when min or max is NaN, an error is thrown", () => {
    expect(() => createRng(0).int(NaN, 2)).toThrow(
      "min and max need to be whole numbers",
    );
    expect(() => createRng(0).int(1, NaN)).toThrow(
      "min and max need to be whole numbers",
    );
  });
});

describe("rng.chance", () => {
  test("rng.chance(0.35) returns true 35% of the time", () => {
    const proportion =
      takeChance(createRng(0), 10000, 0.35).filter((val) => val).length / 10000;
    expect(proportion).toBeGreaterThanOrEqual(0.33);
    expect(proportion).toBeLessThanOrEqual(0.37);
  });

  test("rng.chance(0.8) returns true 80% of the time", () => {
    const proportion =
      takeChance(createRng(0), 10000, 0.8).filter((val) => val).length / 10000;
    expect(proportion).toBeGreaterThanOrEqual(0.78);
    expect(proportion).toBeLessThanOrEqual(0.82);
  });

  test("rng.chance(0) never returns true", () => {
    expect(
      takeChance(createRng(0), 10000, 0).filter((val) => val).length,
    ).toEqual(0);
  });

  test("rng.chance(1) always returns true", () => {
    expect(
      takeChance(createRng(0), 10000, 1).filter((val) => val).length,
    ).toEqual(10000);
  });

  test("rng.chance(-0.5) never returns true (clamping causes it to behave like rng.chance(0))", () => {
    expect(
      takeChance(createRng(0), 10000, -0.5).filter((val) => val).length,
    ).toEqual(0);
  });

  test("rng.chance(1.5) always returns true (clamping causes it to behave like rng.chance(1))", () => {
    expect(
      takeChance(createRng(0), 10000, 1.5).filter((val) => val).length,
    ).toEqual(10000);
  });

  test("rng.chance(NaN) throws an error", () => {
    expect(() => createRng(0).chance(NaN)).toThrow(
      "p needs to be a valid number",
    );
  });
});

describe("rng.pick", () => {
  test("when 1000 calls are made to rng.pick([1, 2, 3]), all numbers in {1, 2, 3} are returned", () => {
    const arr = takePick(createRng(0), 1000, [1, 2, 3]);
    const set = new Set(arr);
    expect(set).toEqual(new Set([1, 2, 3]));
  });

  test("rng.pick([]) throws an error", () => {
    expect(() => createRng(0).pick([])).toThrow("arr needs to be non-empty");
  });

  test("rng.pick([1]) returns the same value every time", () => {
    const arr = takePick(createRng(0), 1000, [1]);
    const set = new Set(arr);
    expect(set).toEqual(new Set([1]));
  });
});

describe("rng.shuffle", () => {
  test("the input array from rng.shuffle(array) remains unchanged", () => {
    const arr = [1, 2, 3];
    createRng(0).shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });

  test("the returned array is different from the input array", () => {
    const arr = [1, 2, 3];
    const shuffled = createRng(0).shuffle(arr);
    expect(arr).not.toBe(shuffled);
  });

  test("the returned array contains the same elements as the input array", () => {
    const arr = [1, 2, 3];
    const shuffled = createRng(0).shuffle(arr);
    expect([...shuffled].sort()).toEqual([...arr].sort());
  });

  test("every ordering of the input array is reachable over 10,000 calls", () => {
    const arr = [1, 2, 3];
    const set = new Set(takeShuffle(createRng(0), 10000, arr));
    expect(set.size).toEqual(6);
  });

  test("rng.shuffle([]) returns []", () => {
    expect(createRng(0).shuffle([])).toEqual([]);
  });
});

const take = (rng: Rng, n: number) =>
  Array.from({ length: n }, () => rng.next());

const takeInt = (rng: Rng, n: number, min: number = 1, max: number = 3) =>
  Array.from({ length: n }, () => rng.int(min, max));

const takeChance = (rng: Rng, n: number, p: number) =>
  Array.from({ length: n }, () => rng.chance(p));

const takePick = (rng: Rng, n: number, arr: number[]) =>
  Array.from({ length: n }, () => rng.pick(arr));

const takeShuffle = (rng: Rng, n: number, arr: number[]) =>
  Array.from({ length: n }, () => rng.shuffle(arr).join(","));

function expectWellBehaved(rng: Rng) {
  // Check that the sequence varies call to call
  expectSequenceVaries(rng);

  // Check that the values are in [0, 1)
  expectSequenceInBounds(rng);
}

function expectSequenceVaries(rng: Rng) {
  const arr = take(rng, 10);
  const varies = new Set(arr).size === arr.length;
  expect(varies).toEqual(true);
}

function expectSequenceInBounds(rng: Rng) {
  const arr = take(rng, 10);
  expect(arr.every((val) => val >= 0 && val < 1)).toEqual(true);
}
