import { describe, expect, test } from "vitest";
import {
  buildSystemPrompt,
  buildUserMessage,
  describeEvent,
  factsSection,
  inventorySection,
  listOrNone,
  recentSection,
  tagsSection,
  weaponSection,
} from "./prompt";
import {
  HEALTH_PER_REST,
  weaponDefinitions,
  type AllianceBetrayed,
  type AllianceFormed,
  type AllianceProposalFailed,
  type AllianceProposed,
  type Facts,
  type InventoryItem,
  type MatchEnded,
  type Memory,
  type SponsorGiftDelivered,
  type SponsorGiftUndelivered,
  type Tags,
  type TributeAmmunitionChanged,
  type TributeAttacked,
  type TributeChangedZone,
  type TributeDied,
  type TributeForaged,
  type TributeGainedItem,
  type TributeHealthChanged,
  type TributeHid,
  type TributeHungerChanged,
  type TributeId,
  type TributeRested,
  type UnseenAttack,
  type WitnessedEvent,
  type ZoneClosed,
  type ZoneFlooded,
  type ZoneFoodChanged,
  type ZoneWaterChanged,
} from "@arena/shared";
import { ev, makePerception } from "./testFixtures";

const names = { t1: "Kael", t2: "Mara", t3: "Gwen", t4: "Kathryn" };

describe("prompt", () => {
  // System Prompt
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
      promptTwo.split("<character_description>")[0],
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

  test("rest line contains HEALTH_PER_REST constant", () => {
    const prompt = buildSystemPrompt({
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
    });

    expect(prompt).toContain(`Resting gives +${HEALTH_PER_REST}hp`);
  });

  // User Prompt

  // describeEvent

  test("never a bare id: throws if names doesn't contain an id", () => {
    expect(() =>
      describeEvent(
        ev({
          type: "TributeRested",
          tributeId: "t2",
          location: "centre",
        }) as TributeRested,
        "t1",
        {},
      ),
    ).toThrow("no name for tribute t2");
  });

  test.each([
    ev({
      type: "TributeHungerChanged",
      tributeId: "t1",
      delta: 10,
      hunger: 50,
      location: "centre",
    }) as TributeHungerChanged,
    ev({
      type: "TributeHealthChanged",
      tributeId: "t1",
      delta: -10,
      hp: 60,
      location: "centre",
    }) as TributeHealthChanged,
    ev({
      type: "TributeAmmunitionChanged",
      tributeId: "t1",
      delta: 10,
      ammunition: 50,
      location: "centre",
      itemId: "bow-1",
    }) as TributeAmmunitionChanged,
    ev({
      type: "ZoneFoodChanged",
      zoneId: "centre",
      delta: 10,
      food: 50,
      location: "centre",
    }) as ZoneFoodChanged,
    ev({
      type: "ZoneWaterChanged",
      zoneId: "centre",
      delta: 10,
      water: 50,
      location: "centre",
    }) as ZoneWaterChanged,
    ev({
      type: "SponsorGiftUndelivered",
      to: "t1",
      giftId: "g1",
      reason: "noMatchingWeapon",
      location: "centre",
    }) as SponsorGiftUndelivered,
    ev({
      type: "MatchEnded",
      result: {
        rounds: 10,
        winnerId: "t3",
        placements: ["t3", "t2", "t1"],
        kind: "lastStanding",
      },
      location: "centre",
    }) as MatchEnded,
  ])("$type is skipped", (event) => {
    expect(describeEvent(event, "t1", names)).toBeNull();
  });

  test.each([
    {
      event: ev({
        type: "TributeAttacked",
        attackerId: null,
        victimId: "t1",
        location: "centre",
        outcome: "hit",
        weaponDefinitionId: "crowbar",
      }) as UnseenAttack,
      expected: "an unseen attacker attacked you and hit.",
    },
    {
      event: ev({
        type: "TributeAttacked",
        attackerId: null,
        victimId: "t1",
        location: "centre",
        outcome: "missed",
        weaponDefinitionId: "crowbar",
      }) as UnseenAttack,
      expected: "an unseen attacker attacked you but missed.",
    },
    {
      event: ev({
        type: "TributeAttacked",
        attackerId: "t1",
        victimId: "t2",
        location: "centre",
        outcome: "hit",
        weaponDefinitionId: "crowbar",
      }) as TributeAttacked,
      expected: "you attacked Mara (t2) and hit.",
    },
    {
      event: ev({
        type: "TributeAttacked",
        attackerId: "t1",
        victimId: "t2",
        location: "centre",
        outcome: "missed",
        weaponDefinitionId: "crowbar",
      }) as TributeAttacked,
      expected: "you attacked Mara (t2) but missed.",
    },
    {
      event: ev({
        type: "TributeAttacked",
        attackerId: "t1",
        victimId: "t2",
        location: "centre",
        outcome: "notFound",
        weaponDefinitionId: "crowbar",
      }) as TributeAttacked,
      expected: "you attacked Mara (t2) but couldn't find them.",
    },
    {
      event: ev({
        type: "TributeAttacked",
        attackerId: "t1",
        victimId: "t2",
        location: "centre",
        outcome: "targetGone",
        weaponDefinitionId: "crowbar",
      }) as TributeAttacked,
      expected: "you attacked Mara (t2) but they were gone.",
    },
    {
      event: ev({
        type: "TributeAttacked",
        attackerId: "t1",
        victimId: "t2",
        location: "centre",
        outcome: "pinnedDown",
        weaponDefinitionId: "crowbar",
      }) as TributeAttacked,
      expected: "you attacked Mara (t2) but they pinned you down.",
    },
    {
      event: ev({
        type: "TributeForaged",
        tributeId: "t1",
        location: "centre",
        success: true,
      }) as TributeForaged,
      expected: "you successfully foraged.",
    },
    {
      event: ev({
        type: "TributeForaged",
        tributeId: "t1",
        location: "centre",
        success: false,
      }) as TributeForaged,
      expected: "you failed to forage.",
    },
    {
      event: ev({
        type: "TributeForaged",
        tributeId: "t2",
        location: "centre",
        success: true,
      }) as TributeForaged,
      expected: "Mara (t2) successfully foraged.",
    },
    {
      event: ev({
        type: "TributeForaged",
        tributeId: "t2",
        location: "centre",
        success: false,
      }) as TributeForaged,
      expected: "Mara (t2) failed to forage.",
    },
    {
      event: ev({
        type: "TributeChangedZone",
        tributeId: "t1",
        location: "centre",
        currentZoneId: "river",
        previousZoneId: "centre",
      }) as TributeChangedZone,
      expected: "you moved to the river.",
    },
    {
      event: ev({
        type: "TributeRested",
        tributeId: "t1",
        location: "centre",
      }) as TributeRested,
      expected: "you rested.",
    },
    {
      event: ev({
        type: "TributeRested",
        tributeId: "t2",
        location: "centre",
      }) as TributeRested,
      expected: "Mara (t2) rested.",
    },
    {
      event: ev({
        type: "TributeDied",
        victimId: "t2",
        location: "centre",
        cause: { kind: "hunger" },
      }) as TributeDied,
      expected: "Mara (t2) died of hunger.",
    },
    {
      event: ev({
        type: "TributeDied",
        victimId: "t2",
        location: "centre",
        cause: { kind: "attack", killerId: "t1" },
      }) as TributeDied,
      expected: "Mara (t2) died of an attack by you.",
    },
    {
      event: ev({
        type: "TributeDied",
        victimId: "t2",
        location: "centre",
        cause: { kind: "attack", killerId: "t4" },
      }) as TributeDied,
      expected: "Mara (t2) died of an attack by Kathryn (t4).",
    },
    {
      event: ev({
        type: "TributeHid",
        tributeId: "t1",
        location: "centre",
      }) as TributeHid,
      expected: "you hid.",
    },
    {
      event: ev({
        type: "TributeGainedItem",
        tributeId: "t1",
        location: "centre",
        item: {
          kind: "weapon",
          itemId: "bow-1",
          definitionId: "bow",
          ammunition: 2,
        } as InventoryItem,
      }) as TributeGainedItem,
      expected: "you gained a Recurve Bow.",
    },
    {
      event: ev({
        type: "SponsorGiftDelivered",
        to: "t1",
        senderId: "s1",
        itemDefinitionId: "ration_pack",
        giftId: "g1",
        appliedInRound: 1,
        location: "centre",
      }) as SponsorGiftDelivered,
      expected: "a sponsor sent you a Ration Pack.",
    },
    {
      event: ev({
        type: "ZoneFlooded",
        zoneId: "centre",
        location: "centre",
      }) as ZoneFlooded,
      expected: "the centre flooded.",
    },
    {
      event: ev({
        type: "ZoneClosed",
        zoneId: "centre",
        location: "centre",
      }) as ZoneClosed,
      expected: "the centre closed.",
    },
    {
      event: ev({
        type: "TributeChangedZone",
        tributeId: "t2",
        location: "centre",
        currentZoneId: "river",
        previousZoneId: "centre",
      }) as TributeChangedZone,
      expected: "Mara (t2) moved to the river.",
    },
    {
      event: ev({
        type: "TributeAttacked",
        attackerId: "t2",
        victimId: "t4",
        location: "centre",
        outcome: "hit",
        weaponDefinitionId: "crowbar",
      }) as TributeAttacked,
      expected: "Mara (t2) attacked Kathryn (t4) and hit.",
    },
    {
      event: ev({
        type: "AllianceBetrayed",
        betrayerId: "t2",
        victimId: "t4",
        allianceId: "a1",
        outcome: "success",
        location: "centre",
      }) as AllianceBetrayed,
      expected: "Mara (t2) betrayed Kathryn (t4).",
    },
    {
      event: ev({
        type: "AllianceBetrayed",
        betrayerId: "t2",
        victimId: "t4",
        allianceId: "a1",
        outcome: "targetGone",
        location: "centre",
      }) as AllianceBetrayed,
      expected:
        "Mara (t2) attempted to betray Kathryn (t4) but couldn't find Kathryn (t4).",
    },
    {
      event: ev({
        type: "AllianceBetrayed",
        betrayerId: "t2",
        victimId: "t1",
        allianceId: "a1",
        outcome: "targetGone",
        location: "centre",
      }) as AllianceBetrayed,
      expected: "Mara (t2) attempted to betray you but couldn't find you.",
    },
        {
      event: ev({
        type: "AllianceBetrayed",
        betrayerId: "t2",
        victimId: "t1",
        allianceId: "a1",
        outcome: "pinnedDown",
        location: "centre",
      }) as AllianceBetrayed,
      expected: "Mara (t2) attempted to betray you while pinned down.",
    },
    {
      event: ev({
        type: "AllianceFormed",
        memberIds: ["t2", "t4"],
        allianceId: "a1",
        location: "centre",
      }) as AllianceFormed,
      expected: "Mara (t2) formed an alliance with Kathryn (t4).",
    },
    {
      event: ev({
        type: "AllianceProposalFailed",
        proposerId: "t2",
        targetId: "t1",
        proposalId: "p1",
        reason: "withdrawn",
        location: "centre",
      }) as AllianceProposalFailed,
      expected:
        "the alliance offer from Mara (t2) to you failed: Mara (t2) withdrew the offer by attacking.",
    },
    {
      event: ev({
        type: "AllianceProposalFailed",
        proposerId: "t2",
        targetId: "t4",
        proposalId: "p1",
        reason: "targetAllied",
        location: "centre",
      }) as AllianceProposalFailed,
      expected:
        "the alliance offer from Mara (t2) to Kathryn (t4) failed: Kathryn (t4) already had an ally.",
    },
    {
      event: ev({
        type: "AllianceProposalFailed",
        proposerId: "t2",
        targetId: "t4",
        proposalId: "p1",
        reason: "proposerAllied",
        location: "centre",
      }) as AllianceProposalFailed,
      expected:
        "the alliance offer from Mara (t2) to Kathryn (t4) failed: Mara (t2) already had an ally.",
    },
    {
      event: ev({
        type: "AllianceProposalFailed",
        proposerId: "t2",
        targetId: "t4",
        proposalId: "p1",
        reason: "proposerGone",
        location: "centre",
      }) as AllianceProposalFailed,
      expected:
        "the alliance offer from Mara (t2) to Kathryn (t4) failed: Kathryn (t4) couldn't find Mara (t2).",
    },
    {
      event: ev({
        type: "AllianceProposalFailed",
        proposerId: "t1",
        targetId: "t4",
        proposalId: "p1",
        reason: "proposerGone",
        location: "centre",
      }) as AllianceProposalFailed,
      expected:
        "the alliance offer from you to Kathryn (t4) failed: Kathryn (t4) couldn't find you.",
    },
    {
      event: ev({
        type: "AllianceProposalFailed",
        proposerId: "t2",
        targetId: "t4",
        proposalId: "p1",
        reason: "targetGone",
        location: "centre",
      }) as AllianceProposalFailed,
      expected:
        "the alliance offer from Mara (t2) to Kathryn (t4) failed: Mara (t2) couldn't find Kathryn (t4).",
    },
    {
      event: ev({
        type: "AllianceProposalFailed",
        proposerId: "t2",
        targetId: "t1",
        proposalId: "p1",
        reason: "targetGone",
        location: "centre",
      }) as AllianceProposalFailed,
      expected:
        "the alliance offer from Mara (t2) to you failed: Mara (t2) couldn't find you.",
    },
    {
      event: ev({
        type: "AllianceProposalFailed",
        proposerId: "t2",
        targetId: "t4",
        proposalId: "p1",
        reason: "ignored",
        location: "centre",
      }) as AllianceProposalFailed,
      expected:
        "the alliance offer from Mara (t2) to Kathryn (t4) failed: Kathryn (t4) ignored the offer.",
    },
    {
      event: ev({
        type: "AllianceProposed",
        proposerId: "t1",
        targetId: "t2",
        proposalId: "p1",
        location: "centre",
      }) as AllianceProposed,
      expected: "you proposed an alliance to Mara (t2).",
    },
  ])("$event.type → $expected", ({ event, expected }) => {
    expect(describeEvent(event, "t1", names)).toBe(expected);
  });

  // recentSection

  test("rounds 7, 7, 8 → ['Round 7:', e1, e2, 'Round 8:', e3]", () => {
    const events: WitnessedEvent[] = [
      ev(
        {
          type: "TributeRested",
          tributeId: "t2",
          location: "centre",
        },
        20,
        7,
      ) as TributeRested,
      ev(
        {
          type: "TributeRested",
          tributeId: "t2",
          location: "centre",
        },
        24,
        7,
      ) as TributeRested,
      ev(
        {
          type: "TributeRested",
          tributeId: "t2",
          location: "centre",
        },
        28,
        8,
      ) as TributeRested,
    ];

    expect(recentSection(events, "t1", names)).toEqual([
      "Round 7:",
      describeEvent(events[0] as WitnessedEvent, "t1", names),
      describeEvent(events[1] as WitnessedEvent, "t1", names),
      "Round 8:",
      describeEvent(events[2] as WitnessedEvent, "t1", names),
    ]);
  });

  test("empty → [] (so listOrNone prints 'none')", () => {
    expect(recentSection([], "t1", names)).toEqual([]);
  });

  test("a round with only skipped events produces no heading", () => {
    const events = [
      ev(
        {
          type: "ZoneWaterChanged",
          zoneId: "centre",
          delta: -1,
          water: 5,
          location: "centre",
        },
        3,
        1,
      ) as ZoneWaterChanged,
      ev(
        {
          type: "ZoneFoodChanged",
          zoneId: "centre",
          delta: -1,
          food: 5,
          location: "centre",
        },
        5,
        1,
      ) as ZoneFoodChanged,
      ev(
        {
          type: "TributeHungerChanged",
          tributeId: "t1",
          delta: 5,
          hunger: 50,
          location: "centre",
        },
        7,
        1,
      ) as TributeHungerChanged,
      ev(
        {
          type: "TributeRested",
          tributeId: "t2",
          location: "centre",
        },
        10,
        2,
      ) as TributeRested,
    ];

    expect(recentSection(events, "t1", names)).toEqual([
      "Round 2:",
      "Mara (t2) rested.",
    ]);
  });

  // factsSection

  test("factsSection converts data correctly: Kathryn (t4): attacked you 2× (last round 11) · last seen river, round 11 · killed Mara (t2)", () => {
    const facts: Record<TributeId, Facts> = {
      t4: {
        attackedYou: 2,
        lastAttackedYou: 11,
        lastSeen: { position: "river", round: 11 },
        killed: ["t2"],
      },
    };

    expect(factsSection(facts, "t1", names)).toEqual([
      "Kathryn (t4): attacked you 2× (last round 11) · killed Mara (t2) · last seen river, round 11",
    ]);
  });

  test("absent fields don't appear: no 'attacked you 0×', no empty 'killed:'", () => {
    const facts: Record<TributeId, Facts> = {
      t4: {
        lastSeen: { position: "river", round: 11 },
      },
    };

    expect(factsSection(facts, "t1", names)).toEqual([
      "Kathryn (t4): last seen river, round 11",
    ]);
  });

  test("a dead tribute is shown as 'Kathryn (t4): died in round x'", () => {
    const facts: Record<TributeId, Facts> = {
      t4: {
        lastSeen: { position: "river", round: 11 },
        diedRound: 11,
      },
    };

    expect(factsSection(facts, "t1", names)).toEqual([
      "Kathryn (t4): last seen river, round 11 · died in round 11",
    ]);
  });

  test("all facts other than heading exist → 'Kathryn (t4): attacked you 2× (last round 11) · you attacked 2× (last round 11) · killed Mara (t2) · last seen river, round 11 · weapons seen Crowbar, Throwing Knives · died in round 11'", () => {
    const facts: Record<TributeId, Facts> = {
      t4: {
        attackedYou: 2,
        lastAttackedYou: 11,
        lastSeen: { position: "river", round: 11 },
        killed: ["t2"],
        weaponsSeen: ["crowbar", "throwing_knives"],
        diedRound: 11,
        youAttacked: 2,
        youLastAttacked: 11,
      },
    };

    expect(factsSection(facts, "t1", names)).toEqual([
      "Kathryn (t4): attacked you 2× (last round 11) · you attacked 2× (last round 11) · killed Mara (t2) · last seen river, round 11 · weapons seen Crowbar, Throwing Knives · died in round 11",
    ]);
  });

  test("throws when there is no name for the tributeId", () => {
    const facts: Record<TributeId, Facts> = {
      t9: {
        lastSeen: { position: "river", round: 11 },
      },
    };

    expect(() => factsSection(facts, "t1", names)).toThrow("t9");
  });

  // tagsSection

  test("{ 't4': ['dangerous', 'avoid'] } → 'Kathryn (t4): dangerous, avoid'", () => {
    const tags: Record<TributeId, Tags> = {
      t4: ["dangerous", "avoid"],
    };

    expect(tagsSection(tags, "t1", names)).toEqual([
      "Kathryn (t4): dangerous, avoid",
    ]);
  });

  test("no tags → []", () => {
    expect(tagsSection({}, "t4", names)).toEqual([]);
  });

  test("skips selfId", () => {
    const tags: Record<TributeId, Tags> = {
      t4: ["dangerous", "avoid"],
      t1: ["dangerous", "avoid"],
    };

    expect(tagsSection(tags, "t1", names)).toEqual([
      "Kathryn (t4): dangerous, avoid",
    ]);
  });

  // buildUserMessage

  test("the sections appear in the agreed order (check indexOf)", () => {
    const perception = makePerception();
    const memory: Memory = { recent: [], facts: {} };
    const tags: Record<TributeId, Tags> = {};

    const userMessage = buildUserMessage(perception, memory, tags, names);

    const expectedPositions = [
      "Round ",
      "What you remember",
      "What you know about other tributes",
      "Your tags",
      "You now",
      "Your zone",
      "Tributes here",
      "You can do this round",
    ];

    const positions = expectedPositions.map((e) => userMessage.indexOf(e));

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((e) => e >= 0)).toBe(true);
  });

  test("with no visible tributes, there's no - hunt: line and the word false appears nowhere", () => {
    const perception = makePerception({ visibleTributes: [] });
    const memory: Memory = { recent: [], facts: {} };
    const tags: Record<TributeId, Tags> = {};
    const names: Record<TributeId, string> = {};

    expect(buildUserMessage(perception, memory, tags, names)).not.toContain(
      "false",
    );
    expect(buildUserMessage(perception, memory, tags, names)).not.toContain(
      "- hunt:",
    );
  });

  test("hidLastRound shows as 'hid last round' and tribute who didn't hide doesn't get the label", () => {
    const perception = makePerception({
      visibleTributes: [
        {
          tributeId: "t2",
          name: "Mara",
          hidLastRound: true,
          allyId: null,
        },
        {
          tributeId: "t4",
          name: "Kathryn",
          hidLastRound: false,
          allyId: null,
        },
      ],
    });
    const memory: Memory = { recent: [], facts: {} };
    const tags: Record<TributeId, Tags> = {};
    const names: Record<TributeId, string> = {};

    const userMessage = buildUserMessage(perception, memory, tags, names);
    expect(userMessage).toContain("Mara (t2), hid last round\n");
    expect(userMessage).not.toContain("Kathryn (t4), hid last round\n");
    expect(userMessage).not.toContain("false");
  });

  test("the hunt line lists ids, which are what the model must reply with", () => {
    const perception = makePerception({
      visibleTributes: [
        {
          tributeId: "t2",
          name: "Mara",
          hidLastRound: true,
          allyId: null,
        },
        {
          tributeId: "t4",
          name: "Kathryn",
          hidLastRound: false,
          allyId: null,
        },
      ],
    });
    const memory: Memory = { recent: [], facts: {} };
    const tags: Record<TributeId, Tags> = {};
    const names: Record<TributeId, string> = {};

    expect(buildUserMessage(perception, memory, tags, names)).toContain(
      "- hunt: t2, t4",
    );
  });

  test("Round 1:\n appears in user message", () => {
    const perception = makePerception();
    const memory: Memory = {
      recent: [
        ev(
          { type: "TributeRested", tributeId: "t2", location: "centre" },
          5,
          1,
        ) as TributeRested,
      ],
      facts: {},
    };
    const tags: Record<TributeId, Tags> = {};

    expect(buildUserMessage(perception, memory, tags, names)).toContain(
      "Round 1:\nMara (t2) rested.",
    );
  });

  // inventorySection

  test("no inventory → []", () => {
    expect(inventorySection([])).toEqual([]);
  });

  test("one inventory item → 'Spear'", () => {
    expect(
      inventorySection([
        {
          kind: "weapon",
          definitionId: "spear",
          itemId: "spear-0",
          ammunition: null,
        },
      ]),
    ).toEqual(["Spear"]);
  });

  test("bow with ammunition → 'Recurve Bow (2 ammo)'", () => {
    expect(
      inventorySection([
        {
          kind: "weapon",
          definitionId: "bow",
          itemId: "bow-0",
          ammunition: 2,
        },
      ]),
    ).toEqual(["Recurve Bow (2 ammo)"]);
  });

  // listOrNone

  test("[] → 'none'", () => {
    expect(listOrNone([])).toEqual("none");
  });

  test("['a', 'b'] → 'a, b'", () => {
    expect(listOrNone(["a", "b"])).toEqual("a, b");
  });
});
