import { describe, expect, test } from "vitest";

describe("createMatch", () => {
  // Creates
  test("all tributes in the match have a hp of 100", () => {});

  test("all tributes in the match have hunger of 0", () => {});

  test("all tributes in the match are alive", () => {});

  test("all tributes in the match have a memory of []", () => {});

  test("all tributes in the match have an inventory that holds one WeaponInstance with the id of spear-0", () => {});

  test("the round is 0", () => {});

  test("the seq is 0", () => {});

  test("the nextItemId is tributes.length", () => {});

  test("rngState is equal to the state after one shuffle", () => {});

  test("every tribute's position is one of the arena's starting zones", () => {});

  test("when the number of tributes is greater than the number of starting zones, the extra tributes are places in the i % zones.length zones", () => {});

  //Determinism
  test("the same config gives the same GameState", () => {});

  // Throws
  test("throws when there are fewer than 2 tributes", () => {});

  test("throws when two tributes share a tributeId", () => {});

  test("throws when there is a empty matchId", () => {});

  test("throws when there is a tribute with an invalid startingWeaponDefId", () => {});
});
