Sponsor gifts

| Item       | Effect on arrival | Reasoning                         | Cost     |
| ---------- | ----------------- | --------------------------------- | -------- |
| Ration pack | hunger -30 | same as finding food (HUNGER_VALUE.food) |          |
| Water flask | hunger -15 | same as finding water |          |
| Medkit | HP +40 | roughly one hit's worth plus a bit, enough to change a fight but not reset it |          |
| Arrows | bow ammunition +3 | a full bow's starting supple |          |
| Throwing knives | knives ammunition +3 | half of their starting 6 |          |


Rules:
1. Gifts apply at the start of the round before initiative
2. On successful delivery of a gift, the SponsorGiftDelivered event is emmitted, followed by the event corresponding to the change in state (e.g. TributeAmmunitionChanged)
3. On unsuccessful delivery (the tribute is dead in the round it applies), only the SponsorGiftUndelivered event is emitted.
4. If Arrows are sent to a tribute with two bows, the ammunition will be added to the bow with the most ammunition
5. The SponsorItemDefinition has an effects field containing an array of effects (SponsorItemEffect), where SponsorItemEffect is a union of effects
6. The engine will throw on unknown items, unknown tributes, and duplicate Ids
7. All unresolved gifts will be passed, and only the gifts corresponding to that round will be applied

Tests

Events
- On a successful delivey of a Ration pack, a SponsorGiftDelivered (ration pack −30) event (single event) and a TributeHungerChanged (hunger 10 gives delta -10 hunger 0) event will be emitted 
- On a successful delivey of a Water flask, a SponsorGiftDelivered (water flask -15) event (single event) and a TributeHungerChanged (hunger 10 gives delta -10 hunger 0) event will be emitted
- On a successful delivey of a Medkit, a SponsorGiftDelivered (medkit +40) event (single event) and a TributeHealthChanged (hp 90 gives delta +10 hp 100) event will be emitted
- On a successful delivey of Arrows, a SponsorGiftDelivered (arrows +3) event (single event) and a TributeAmmunitionChanged event will be emitted
- On a successful delivey of Throwing knives, a SponsorGiftDelivered (throwing knives +3) event (single event) and a TributeAmmunitionChanged event will be emitted
- If the tribute is dead during the round the gift is applied, the event will be unsuccessful and emit a SponsorGiftUndelivered event
- seq: within each gift, SposoredGiftDelivered comes before change event
- seq: all gift events come before any action event

Rules
- Gifts will be applied at the start of the round, so a tribute that hides on 1 hp and 100 hunger will survive when a health pack is donated
- If Arrows are sent to a tribute with two bows, the ammunition will be added to the bow with the most ammunition
- If Arrows are sent to a tribute with two bows of identical ammunition, it will be applied in the inventories array order
- Only the gifts corresponding to that round will be applied
- A gift changes the outcome of later rounds, and never earlier ones (same seed and decisions twice, once without gift and once with for round 5 -> assert that the events for round 1-4 are identical, and that round 5 onwards differs)
- When arrows are delivered to a tribute with no bow, the SponsorGiftUndelivered event will be emitted with a reason of "noMatchingWeapon"
- Only the events for the current round will be passed

Errors
- An error will be thrown when an unknown gift is sent
- An error will be thrown when a gift is sent to an unknown tribute
- duplicate giftId throws
- gifts don't use the RNG (rngState is the same as a round without gifts), and the input gifts array isn't changed

