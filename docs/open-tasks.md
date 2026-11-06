# Open tasks: combat (Phase 1, step 5)

Line numbers refer to `packages/sim/src/resolveRound.test.ts` and will drift as you edit.

## Tests to update

- [ ] **Ammo test (line 983):** split into three tests:
  - hit/missed: −1, `TributeAmmunitionChanged` with `ammunition: 9`
  - targetGone: t2 in another zone, no ammo event, still 10
  - notFound: master-hider stats with t2 hiding, no ammo event, still 10
- [ ] **"Evenly matched spotting" (line 879):** count with `!== "notFound"` and give it a clearer name
- [ ] **Master hider (line 813):** remove "cover high" from the name, and put the numbers in the comment: 10 × 1.5 + d6 = 16–21 vs 1 + d6 = 2–7, so it can never be spotted
- [ ] **0-ammo bow (line 948):** assert `"unarmed"` on any found outcome (hit or missed), not just one
- [ ] **chooseWeapon comment (line 1060):** change to `24 + 10*2 = 44 > 28 + 1*2 = 30`
- [ ] **"unarmed never appears…" (line 1074):** empty body passes vacuously. Make it `test.todo` until written
- [ ] **Comment plan below it** still uses old numbers:
  - Hit example: spear, strength 5, against agility 5 = 0.2 + 0.5 − 0.25 = **0.45**
  - Damage example: 24 + 10 − floor(2.5) = **32**
  - "killer gains their inventory" → "gains the victim's weapon with its remaining ammunition"
- [ ] Drop the leftover `seq!`

## Tests to write

### `hitChance` unit tests

Export it first. Use `toBeCloseTo` (floating point).

- [ ] Even fight, attacker stat 6 against agility 6: **0.5**
- [ ] Attacker stat 10 against agility 1: **0.8** (clamped, should start red)
- [ ] Attacker stat 1 against agility 10: **0.1** (clamped, should start red)
- [ ] Scales with the weapon's stat: a bow uses agility, so strength 10 and agility 1 gives 0.2 + 0.1 − victim dodge
- [ ] Unarmed scales with strength

### Hit roll (integration)

- [ ] Rate test: over 200 seeds, the hit rate is the `hitChance` value ± 0.1. t2 not hiding, guaranteed found

### Damage

Pull out a pure `damage()` helper, with exact `toBe`.

- [ ] Spear, strength 5, against endurance 5: **32**
- [ ] Toughness is floored: endurance 5 takes off **2**, not 2.5
- [ ] On hit: victim HP falls by the damage, `TributeHealthChanged` has `delta: -32` and the new `hp`
- [ ] On miss: no `TributeHealthChanged` for the victim

### Death

- [ ] HP ≤ 0 ends at **0** (not negative), `alive: false`, `TributeDied` has `kind: "killed"` and the correct `killerId`
- [ ] Killer gets the victim's weapon with its remaining ammunition, plus `TributeGainedItem`; the weapon leaves the victim's inventory
- [ ] A victim with no weapons gives no `TributeGainedItem` (unarmed is never looted)
- [ ] A victim killed earlier in initiative doesn't act later that round

### Two-way and ranged

- [ ] Melee, victim survives and hunts back: both attacks happen
- [ ] Melee, first hit kills: the second attack never happens
- [ ] Ranged hit: the victim's later hunt that round is `pinnedDown`, with `weaponDefinitionId: ""` and no ammo spent
- [ ] Ranged hit, but the victim acted earlier in initiative: their attack happens as normal

### Events

- [ ] A kill emits, in `seq` order: `TributeAttacked` → `TributeAmmunitionChanged` (if ranged) → `TributeHealthChanged` → `TributeDied` → `TributeGainedItem`
- [ ] `notFound`, `targetGone` and `pinnedDown` emit only `TributeAttacked`

### Safety

- [ ] Input unchanged, and determinism, using a round that includes hunts

### createMatch

- [ ] Starting ammunition comes from the definition: bow **3**, throwing knives **6**, spear **null**
