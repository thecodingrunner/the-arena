1. round += 1
2. Roll initiative once: shuffle, then stable-sort by stealth + intelligence + roll
3. Resolve each action in that order (skipping anyone who's dead), with success calculated per action
4. Hunger tick for everyone still alive

## Round resolution (Phase 1 step 4)

### Order of a round
1. `round += 1`
2. Roll initiative once per round: shuffle alive tributes, then stable-sort by `stealth + intelligence + rng.int(1, INITIATIVE_DIE)` (highest first). The shuffle breaks ties randomly but deterministically.
3. Resolve each action in initiative order. Skip tributes who died earlier in the round. Each action calculates its own success.
4. Hunger tick for every tribute still alive.

### Actions and rules

| Action | Rule | Events emitted |
|---|---|---|
| `forage` | Success chance = `0.4 + intelligence × 0.05 + weapon foragingBonus × 0.05`, capped at 0.9. On success: if `zone.food > 0`, food −1 and hunger −30; otherwise if `zone.water > 0`, water −1 and hunger −15. Hunger never goes below 0. Food and water never regrow. | `TributeForaged { success }`; on success also `ZoneFoodChanged` or `ZoneWaterChanged`, and `TributeHungerChanged` |
| `rest` | hp +10 (max 100) | `TributeRested`, `TributeHealthChanged` |
| `move_to` | Position becomes the target zone. Extra hunger = edge `cost × 3`. Arrives the same round; cost only adds hunger. | `TributeChangedZone`, `TributeHungerChanged` |
| **Hunger tick** (automatic, end of round) | hunger `+ (10 − floor(endurance / 4))`, capped at 100. At 100, hp −10. At hp ≤ 0, `alive = false` | `TributeHungerChanged`, `TributeHealthChanged`, `TributeDied { cause: { kind: "hunger" } }` |
| `hunt` | See combat.md |  |

### Deferred
- `hide`: step 5 (only matters for spotting in combat)
- `use_item`: step 7 (sponsor items arrive with gifts)
- Status effects (bitten, poisoned, treated): steps 7 and 10

### Tuning
All numbers above are named constants, to be tuned during playtesting (step 12).

### Ending rules
A match comes to an end when the maximum number of rounds is reached, or the number of tributes left is less than two. If there is a tiebreak, the winner will be decided by the following chain:
hp at start of round -> kills -> endurance roll (with a seeded shuffle under it so ties can't happen)
When the match comes to an end, the MatchEnded event is emitted with the MatchEnded data

### Context snapshot and perception
the tribute should know: everything the tribute could know in the game world, and nothing it couldn't