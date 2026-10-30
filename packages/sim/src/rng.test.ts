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

const take = (rng: { next: () => number }, n: number) =>
  Array.from({ length: n }, () => rng.next());

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
