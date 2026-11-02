import { describe, expect, test } from "vitest";
import { createRng } from "./rng";

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
    expect(() => createRng(NaN)).toThrow();
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
  })

  test("when min is bigger than max, an error is thrown", () => {
    expect(() => createRng(0).int(2, 1)).toThrow();
  });

  test("when min is equal to max, the same number is returned every time", () => {
    const arr = takeInt(createRng(0), 1000, 2, 2);
    const set = new Set(arr);
    expect(set).toEqual(new Set([2]));
  })

  test("when min or max is decimal, an error is thrown", () => {
    expect(() => createRng(0).int(1.5, 2)).toThrow();
    expect(() => createRng(0).int(1, 2.5)).toThrow();
  });

  test("when min or max is NaN, an error is thrown", () => {
    expect(() => createRng(0).int(NaN, 2)).toThrow();
    expect(() => createRng(0).int(1, NaN)).toThrow();
  })
});

const take = (rng: { next: () => number }, n: number) =>
  Array.from({ length: n }, () => rng.next());


const takeInt = (
  rng: { int: (min: number, max: number) => number },
  n: number,
  min: number = 1,
  max: number = 3
) => Array.from({ length: n }, () => rng.int(min, max));

function expectWellBehaved(rng: { next: () => number }) {
  // Check that the sequence varies call to call
  expectSequenceVaries(rng);

  // Check that the values are in [0, 1)
  expectSequenceInBounds(rng);
}

function expectSequenceVaries(rng: { next: () => number }) {
  const arr = take(rng, 10);
  const varies = new Set(arr).size === arr.length;
  expect(varies).toEqual(true);
}

function expectSequenceInBounds(rng: { next: () => number }) {
  const arr = take(rng, 10);
  expect(arr.every((val) => val >= 0 && val < 1)).toEqual(true);
}
