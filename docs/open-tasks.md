# Open tasks: combat (Phase 1, step 5)

## Tests to write

### Death

- [ ] HP ≤ 0 ends at **0** (not negative), `alive: false`, `TributeDied` has `kind: "killed"` and the correct `killerId`
- [ ] Killer gets the victim's weapon with its remaining ammunition, plus `TributeGainedItem`; the weapon leaves the victim's inventory
- [ ] A victim with no weapons gives no `TributeGainedItem` (unarmed is never looted)
- [ ] A victim killed earlier in initiative doesn't act later that round

### Two-way and ranged

- [ ] Melee, victim survives and hunts back: both attacks happen
- [ ] Melee, first hit kills: the second attack never happens
- [ ] Pinned test: also assert t2's event has `weaponDefinitionId: ""` and t2 spends no ammo
- [ ] Ranged hit, but the victim acted earlier in initiative: their attack happens as normal

### Events

- [ ] A kill emits, in `seq` order: `TributeAttacked` → `TributeAmmunitionChanged` (if ranged) → `TributeHealthChanged` → `TributeDied` → `TributeGainedItem`
- [ ] `notFound`, `targetGone` and `pinnedDown` emit only `TributeAttacked`

### Safety

- [ ] Input unchanged, and determinism, using a round that includes hunts

### createMatch

- [ ] Starting ammunition comes from the definition: bow **3**, throwing knives **6**, spear **null**
