import { describe, expect, test } from "vitest";
import { createMatch } from "./createMatch";
import {
  filterEvents,
  findEvent,
  makeConfig,
  makeGift,
  markDead,
} from "./testFixtures";
import { resolveRound } from "./resolveRound";
import type { RoundActions, SponsorGift } from "@arena/shared";

describe("gifts", () => {
  // Events
  // - On a successful delivery of a Ration pack, a SponsorGiftDelivered (ration pack −30) event (single event) and a TributeHungerChanged (hunger 10 gives delta -10 hunger 0) event will be emitted
  // - On a successful delivery of a Water flask, a SponsorGiftDelivered (water flask -15) event (single event) and a TributeHungerChanged (hunger 10 gives delta -10 hunger 0) event will be emitted
  // - On a successful delivery of a Medkit, a SponsorGiftDelivered (medkit +40) event (single event) and a TributeHealthChanged (hp 90 gives delta +10 hp 100) event will be emitted
  // - On a successful delivery of Arrows, a SponsorGiftDelivered (arrows +3) event (single event) and a TributeAmmunitionChanged event will be emitted
  // - On a successful delivery of Throwing knives, a SponsorGiftDelivered (throwing knives +3) event (single event) and a TributeAmmunitionChanged event will be emitted
  // - If the tribute is dead during the round the gift is applied, the event will be unsuccessful and emit a SponsorGiftUndelivered event
  // - seq: within each gift, SposoredGiftDelivered comes before change event
  // - seq: all gift events come before any action event

  test("Unclamped: On a successful delivery of a Ration pack, a SponsorGiftDelivered (ration pack −30) event (single event) and a TributeHungerChanged event will be emitted", () => {
    // hunger 50 gives delta -30 hunger 20
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "ration_pack",
    });
    before.tributes[0]!.hunger = 50;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftDelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHungerChanged",
        tributeId: "t1",
        delta: -30,
        hunger: 20,
      }),
    );
  });

  test("Unclamped: On a successful delivery of a Water flask, a SponsorGiftDelivered (water flask -15) event (single event) and a TributeHungerChanged event will be emitted", () => {
    // hunger 50 gives delta -15 hunger 35
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "water_flask",
    });
    before.tributes[0]!.hunger = 50;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftDelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHungerChanged",
        tributeId: "t1",
        delta: -15,
        hunger: 35,
      }),
    );
  });

  test("Unclamped: On a successful delivery of a Medkit, a SponsorGiftDelivered (medkit +40) event (single event) and a TributeHealthChanged event will be emitted", () => {
    // hp 50 gives delta +40 hp 90
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "medkit",
    });
    before.tributes[0]!.hp = 50;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftDelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHealthChanged",
        tributeId: "t1",
        delta: 40,
        hp: 90,
      }),
    );
  });

  test("Clamped: On a successful delivery of a Ration pack, a SponsorGiftDelivered event (single event) and a TributeHungerChanged event will be emitted", () => {
    // hunger 10 gives delta -10 hunger 0
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "ration_pack",
    });
    before.tributes[0]!.hunger = 10;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftDelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHungerChanged",
        tributeId: "t1",
        delta: -10,
        hunger: 0,
      }),
    );
  });

  test("Clamped: On a successful delivery of a Water flask, a SponsorGiftDelivered event (single event) and a TributeHungerChanged event will be emitted", () => {
    // hunger 10 gives delta -10 hunger 0
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "water_flask",
    });
    before.tributes[0]!.hunger = 10;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftDelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHungerChanged",
        tributeId: "t1",
        delta: -10,
        hunger: 0,
      }),
    );
  });

  test("Clamped: On a successful delivery of a Medkit, a SponsorGiftDelivered event (single event) and a TributeHealthChanged event will be emitted", () => {
    // hp 90 gives delta +10 hp 100
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "medkit",
    });
    before.tributes[0]!.hp = 90;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftDelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeHealthChanged",
        tributeId: "t1",
        delta: 10,
        hp: 100,
      }),
    );
  });

  test("On a successful delivery of Arrows, a SponsorGiftDelivered (arrows +3) event (single event) and a TributeAmmunitionChanged event will be emitted", () => {
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "arrows",
    });
    before.tributes[0]!.inventory = [
      {
        kind: "weapon",
        itemId: "bow-1",
        definitionId: "bow",
        ammunition: 3,
      },
    ];

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftDelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeAmmunitionChanged",
        tributeId: "t1",
        delta: 3,
      }),
    );
  });

  test("On a successful delivery of Throwing knives, a SponsorGiftDelivered (throwing knives +3) event (single event) and a TributeAmmunitionChanged event will be emitted", () => {
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "throwing_knives",
    });
    before.tributes[0]!.inventory = [
      {
        kind: "weapon",
        itemId: "throwing_knives-1",
        definitionId: "throwing_knives",
        ammunition: 3,
      },
    ];

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftDelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "TributeAmmunitionChanged",
        tributeId: "t1",
        delta: 3,
      }),
    );
  });

  test("If the tribute is dead during the round the gift is applied, the event will be unsuccessful and emit a SponsorGiftUndelivered event", () => {
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "medkit",
      to: "t1",
    });
    markDead(before, 0, 0);

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift,
    ]);

    const deliveredEvents = filterEvents(events, "SponsorGiftUndelivered");
    expect(deliveredEvents).toHaveLength(1);
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: "SponsorGiftDelivered",
      }),
    );
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: "TributeHealthChanged",
        tributeId: "t1",
      }),
    );
  });

  test("seq: within each gift, SponsorGiftDelivered comes before change event", () => {
    const before = createMatch(makeConfig());
    const sponsorGift1 = makeGift({
      itemDefinitionId: "ration_pack",
      to: "t1",
      giftId: "g1",
    });
    const sponsorGift2 = makeGift({
      itemDefinitionId: "water_flask",
      to: "t2",
      giftId: "g2",
    });
    before.tributes[0]!.hunger = 50;
    before.tributes[1]!.hunger = 50;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "hide" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift1,
      sponsorGift2,
    ]);

    const deliveredEvent1 = findEvent(
      events,
      "SponsorGiftDelivered",
      (e) => e.to === "t1",
    );
    const deliveredEvent2 = findEvent(
      events,
      "SponsorGiftDelivered",
      (e) => e.to === "t2",
    );
    expect(deliveredEvent1).toBeDefined();
    expect(deliveredEvent2).toBeDefined();

    const i = events.indexOf(deliveredEvent1!);
    const j = events.indexOf(deliveredEvent2!);

    expect(events[i + 1]).toMatchObject({
      type: "TributeHungerChanged",
      tributeId: "t1",
      delta: -30,
    });
    expect(events[j + 1]).toMatchObject({
      type: "TributeHungerChanged",
      tributeId: "t2",
      delta: -15,
    });
  });

  test("seq: all gift events come before any action event", () => {
    const before = createMatch(makeConfig());
    const sponsorGift1 = makeGift({
      itemDefinitionId: "ration_pack",
      to: "t1",
      giftId: "g1",
    });
    const sponsorGift2 = makeGift({
      itemDefinitionId: "water_flask",
      to: "t2",
      giftId: "g2",
    });
    before.tributes[0]!.hunger = 50;
    before.tributes[1]!.hunger = 50;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "rest" },
      t3: { type: "forage" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift1,
      sponsorGift2,
    ]);

    expect(events.slice(0, 4).map((e) => e.type)).toEqual([
      "SponsorGiftDelivered",
      "TributeHungerChanged", // g1 → t1
      "SponsorGiftDelivered",
      "TributeHungerChanged", // g2 → t2
    ]);
    expect(events.slice(4).some((e) => e.type === "SponsorGiftDelivered")).toBe(
      false,
    );
  });

  test("all valid gifts are applied, even after a failed gift (no matching weapon)", () => {
    // two gifts in one round, arrows for a tribute with no bow first, then a medkit for someone else, medkit should be delivered
    const before = createMatch(makeConfig());
    const sponsorGift1 = makeGift({
      itemDefinitionId: "arrows",
      to: "t1",
      giftId: "g1",
    });
    const sponsorGift2 = makeGift({
      itemDefinitionId: "medkit",
      to: "t2",
      giftId: "g2",
    });
    before.tributes[0]!.inventory = [];

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    const { events } = resolveRound(before, actions, [
      sponsorGift1,
      sponsorGift2,
    ]);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "SponsorGiftUndelivered",
        to: "t1",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "SponsorGiftDelivered",
        to: "t2",
      }),
    );
  });

  // Rules
  // - Gifts will be applied at the start of the round, so a tribute that hides on 1 hp and 100 hunger will survive when a health pack is donated
  // - If Arrows are sent to a tribute with two bows, the ammunition will be added to the bow with the most ammunition
  // - If Arrows are sent to a tribute with two bows of identical ammunition, it will be applied in the inventories array order
  // - Only the gifts corresponding to that round will be applied
  // - A gift changes the outcome of later rounds, and never earlier ones (same seed and decisions twice, once without gift and once with for round 5 -> assert that the events for round 1-4 are identical, and that round 5 onwards differs)
  // - When arrows are delivered to a tribute with no bow, the SponsorGiftUndelivered event will be emitted with a reason of "noMatchingWeapon"

  test("Gifts will be applied at the start of the round, so a tribute that hides on 1 hp and 100 hunger will survive when a health pack is donated", () => {
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "medkit",
      to: "t1",
    });
    before.tributes[0]!.hp = 1;
    before.tributes[0]!.hunger = 100;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "rest" },
      t3: { type: "forage" },
    };

    const { state: after, events } = resolveRound(before, actions, [
      sponsorGift,
    ]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "SponsorGiftDelivered",
        to: "t1",
        itemDefinitionId: "medkit",
      }),
    );
    expect(after.tributes[0]!.alive).toBe(true);
    // 1 + 40 (medkit) - 10 (hunger tick) = 31
    expect(after.tributes[0]!.hp).toBe(31);
  });

  test("If arrows are sent to a tribute with two bows, the ammunition will be added to the bow with the most ammunition", () => {
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "arrows",
      to: "t1",
    });
    before.tributes[0]!.inventory = [
      {
        kind: "weapon",
        itemId: "bow-1",
        definitionId: "bow",
        ammunition: 2,
      },
      {
        kind: "weapon",
        itemId: "bow-2",
        definitionId: "bow",
        ammunition: 3,
      },
    ];

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "rest" },
      t3: { type: "forage" },
    };

    const { state: after } = resolveRound(before, actions, [sponsorGift]);
    expect(after.tributes[0]!.inventory).toEqual([
      {
        kind: "weapon",
        itemId: "bow-1",
        definitionId: "bow",
        ammunition: 2,
      },
      {
        kind: "weapon",
        itemId: "bow-2",
        definitionId: "bow",
        ammunition: 6,
      },
    ]);
  });

  test("If arrows are sent to a tribute with two bows of identical ammunition, it will be applied in the inventories array order", () => {
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "arrows",
      to: "t1",
    });
    before.tributes[0]!.inventory = [
      {
        kind: "weapon",
        itemId: "bow-1",
        definitionId: "bow",
        ammunition: 3,
      },
      {
        kind: "weapon",
        itemId: "bow-2",
        definitionId: "bow",
        ammunition: 3,
      },
    ];

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "rest" },
      t3: { type: "forage" },
    };

    const { state: after } = resolveRound(before, actions, [sponsorGift]);
    expect(after.tributes[0]!.inventory).toEqual([
      {
        kind: "weapon",
        itemId: "bow-1",
        definitionId: "bow",
        ammunition: 6,
      },
      {
        kind: "weapon",
        itemId: "bow-2",
        definitionId: "bow",
        ammunition: 3,
      },
    ]);
  });

  test("Only the gifts corresponding to that round will be applied (gifts from an earlier or later round will not be applied)", () => {
    const before = createMatch(makeConfig());
    before.round = 3;
    const sponsorGift1 = makeGift({
      itemDefinitionId: "ration_pack",
      to: "t1",
      giftId: "g1",
      appliesInRound: 6,
    });
    const sponsorGift2 = makeGift({
      itemDefinitionId: "water_flask",
      to: "t2",
      giftId: "g2",
      appliesInRound: 4,
    });
    const sponsorGift3 = makeGift({
      itemDefinitionId: "medkit",
      to: "t3",
      giftId: "g3",
      appliesInRound: 2,
    });
    before.tributes[0]!.hunger = 50;
    before.tributes[1]!.hunger = 50;
    before.tributes[0]!.stats.endurance = 0;
    before.tributes[1]!.stats.endurance = 0;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    const { state: after, events } = resolveRound(before, actions, [
      sponsorGift1,
      sponsorGift2,
      sponsorGift3,
    ]);

    const sponsorGiftDeliveredEvents = filterEvents(
      events,
      "SponsorGiftDelivered",
    );

    expect(sponsorGiftDeliveredEvents).toHaveLength(1);
    expect(sponsorGiftDeliveredEvents[0]!.itemDefinitionId).toBe("water_flask");

    expect(after.tributes[0]!.hunger).toBe(60);
    expect(after.tributes[1]!.hunger).toBe(45);
  });

  test("if more than one gifts are applied to the same tribute in the same round, both will be applied in order", () => {
    const before = createMatch(makeConfig());
    before.round = 5;
    const sponsorGift1 = makeGift({
      itemDefinitionId: "ration_pack",
      to: "t1",
      giftId: "g1",
      appliesInRound: 6,
    });
    const sponsorGift2 = makeGift({
      itemDefinitionId: "water_flask",
      to: "t1",
      giftId: "g2",
      appliesInRound: 6,
    });
    before.tributes[0]!.hunger = 50;
    before.tributes[0]!.stats.endurance = 0;

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    const { state: after, events } = resolveRound(before, actions, [
      sponsorGift1,
      sponsorGift2,
    ]);

    const sponsorGiftDeliveredEvents = filterEvents(
      events,
      "SponsorGiftDelivered",
    );

    expect(sponsorGiftDeliveredEvents).toHaveLength(2);
    expect(sponsorGiftDeliveredEvents[0]!.itemDefinitionId).toBe("ration_pack");
    expect(sponsorGiftDeliveredEvents[1]!.itemDefinitionId).toBe("water_flask");

    // 50 - 15 (water flask) - 30 (ration pack) + 10 (hunger tick) = 15
    expect(after.tributes[0]!.hunger).toBe(15);
  });

  function runRounds(actions: RoundActions, gifts?: SponsorGift[]) {
    let state = createMatch(makeConfig());
    const all = [];
    for (let i = 0; i < 8; i++) {
      const roundGifts = gifts?.filter((g) => g.appliesInRound === i + 1);
      const { state: newState, events } = resolveRound(
        state,
        actions,
        roundGifts,
      );
      all.push(...events);
      state = newState;
    }
    return all;
  }

  test("A gift changes the outcome of later rounds, and never earlier ones", () => {
    // same seed and decisions twice, once without gift and once with for round 5 -> assert that the events for round 1-4 are identical, and that round 5 onwards differs

    const sponsorGift1 = makeGift({
      itemDefinitionId: "ration_pack",
      to: "t1",
      giftId: "g1",
      appliesInRound: 5,
    });
    const sponsorGift2 = makeGift({
      itemDefinitionId: "water_flask",
      to: "t2",
      giftId: "g2",
      appliesInRound: 5,
    });

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    const without = runRounds(actions);
    const withGift = runRounds(actions, [sponsorGift1, sponsorGift2]);

    expect(without.slice(0, 4)).toEqual(withGift.slice(0, 4));
    expect(without.slice(4)).not.toEqual(withGift.slice(4));

    expect(withGift).toContainEqual(
      expect.objectContaining({
        type: "SponsorGiftDelivered",
        to: "t1",
        itemDefinitionId: "ration_pack",
        giftId: "g1",
        appliedInRound: 5,
      }),
    );
    expect(withGift).toContainEqual(
      expect.objectContaining({
        type: "SponsorGiftDelivered",
        to: "t2",
        itemDefinitionId: "water_flask",
        giftId: "g2",
        appliedInRound: 5,
      }),
    );
    expect(withGift).toContainEqual(
      expect.objectContaining({
        type: "TributeHungerChanged",
        delta: -30,
        round: 5,
        tributeId: "t1",
      }),
    );
    expect(withGift).toContainEqual(
      expect.objectContaining({
        type: "TributeHungerChanged",
        delta: -15,
        round: 5,
        tributeId: "t2",
      }),
    );
  });

  test("When arrows are delivered to a tribute with no bow, the SponsorGiftUndelivered event will be emitted with a reason of 'noMatchingWeapon'", () => {
    const before = createMatch(makeConfig());
    const sponsorGift = makeGift({
      itemDefinitionId: "arrows",
      to: "t1",
    });
    before.tributes[0]!.inventory = [];

    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    const { events } = resolveRound(before, actions, [sponsorGift]);
    const undeliveredEvents = filterEvents(events, "SponsorGiftUndelivered");
    expect(undeliveredEvents).toHaveLength(1);
    expect(undeliveredEvents[0]!.reason).toBe("noMatchingWeapon");
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: "SponsorGiftDelivered",
      }),
    );
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: "TributeAmmunitionChanged",
        tributeId: "t1",
      }),
    );
  });

  // Errors
  // - An error will be thrown when an unknown gift is sent
  // - An error will be thrown when a gift is sent to an unknown tribute
  // - duplicate giftId throws
  // - gifts don't use the RNG (rngState is the same as a round without gifts), and the input gifts array isn't changed

  test("An error will be thrown when an unknown gift is sent", () => {
    const before = createMatch(makeConfig());
    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    expect(() =>
      resolveRound(before, actions, [
        makeGift({
          itemDefinitionId: "unknown_gift",
          to: "t1",
        }),
      ]),
    ).toThrow("Item definition unknown_gift does not exist");
  });

  test("An error will be thrown when a gift is sent to an unknown tribute", () => {
    const before = createMatch(makeConfig());
    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    expect(() =>
      resolveRound(before, actions, [
        makeGift({
          itemDefinitionId: "ration_pack",
          to: "unknown_tribute",
        }),
      ]),
    ).toThrow("Tribute unknown_tribute does not exist");
  });

  test("duplicate giftId throws", () => {
    const before = createMatch(makeConfig());
    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    expect(() =>
      resolveRound(before, actions, [
        makeGift({
          itemDefinitionId: "ration_pack",
          to: "t1",
          giftId: "g1",
        }),
        makeGift({
          itemDefinitionId: "ration_pack",
          to: "t1",
          giftId: "g1",
        }),
      ]),
    ).toThrow("giftIds must be unique, found duplicates: g1");
  });

  test("gifts don't use the RNG (rngState is the same as a round without gifts), and the input gifts array isn't changed", () => {
    const before = createMatch(makeConfig());
    const actions: RoundActions = {
      t1: { type: "hide" },
      t2: { type: "hide" },
      t3: { type: "forage" },
    };

    const gifts = [
      makeGift({
        itemDefinitionId: "ration_pack",
        to: "t1",
        giftId: "g1",
      }),
    ];
    const snapshot = structuredClone(gifts);

    const { state: afterWith } = resolveRound(before, actions, gifts);
    const { state: afterWithout } = resolveRound(before, actions);

    expect(afterWith.rngState).toEqual(afterWithout.rngState);
    expect(gifts).toEqual(snapshot);
  });
});
