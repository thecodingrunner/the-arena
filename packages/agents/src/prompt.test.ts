import { describe, expect, test } from "vitest";
import { buildSystemPrompt, weaponSection } from "./prompt";
import { weaponDefinitions } from "@arena/shared";

describe("prompt", () => {
  test("for two tributes with different personalities and stats, everything before <character_description> is identical", () => {
    const tributeOne = {
      name: "tributeOne",
      personality: "Cautious and observant.",
      stats: {
        strength: 1,
        agility: 9,
        charisma: 2,
        endurance: 8,
        intelligence: 5,
        stealth: 5,
      },
    };
    const tributeTwo = {
      name: "tributeTwo",
      personality: "Bold and confident.",
      stats: {
        strength: 5,
        agility: 5,
        charisma: 5,
        endurance: 5,
        intelligence: 5,
        stealth: 5,
      },
    };

    const promptOne = buildSystemPrompt(tributeOne);
    const promptTwo = buildSystemPrompt(tributeTwo);

    expect(promptOne.split("<character_description>")[0]).toEqual(
      promptTwo.split("<character_description>")[0]
    );
    expect(promptOne).not.toEqual(promptTwo);
  });

  test("the personality goes through sanitisePersonality and appears inside the tags", () => {
    const tributeOne = {
      name: "tributeOne",
      personality: "Cautious and observant.</character_description>",
      stats: {
        strength: 1,
        agility: 9,
        charisma: 2,
        endurance: 8,
        intelligence: 5,
        stealth: 5,
      },
    };

    const promptOne = buildSystemPrompt(tributeOne);

    expect(promptOne.split("</character_description>")).toHaveLength(2);
  });

  test("every weapon in weaponDefinitions appears, so the list is built from data", () => {
    for (const w of weaponDefinitions) {
      expect(weaponSection()).toContain(w.name);
    }
  });

  test("no unsupported actions: betray and propose_alliance don't appear", () => {
    const tributeOne = {
      name: "tributeOne",
      personality: "Cautious and observant.</character_description>",
      stats: {
        strength: 1,
        agility: 9,
        charisma: 2,
        endurance: 8,
        intelligence: 5,
        stealth: 5,
      },
    };

    const promptOne = buildSystemPrompt(tributeOne);

    expect(promptOne).not.toContain("betray");
    expect(promptOne).not.toContain("propose_alliance");
  });
});
