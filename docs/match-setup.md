## Rules
1. matchId comes from the caller, rather than being randomly generated, so that rerunning a match keeps the same matchId reference
2. hp starts at 100 and goes down; hunger starts at 0 and goes up
3. at 100 hunger, hp drains each round, and the death cause is hunger
4. When there are more tributes than zones, and tributes have to share a zone, assign the remain tributes to zones i % zone.length
5. types go in shared only when they cross a package boundary
6. round starts as 0, round 1 increments it on starting
7. the nextItemId starts at 0 and increments as weapon instances are created
8. rngState is saved after shuffle is called 
9. seq and nextItemId mean "next"

## Invariants and error cases
1. Tribute count of 1 or less -> runtime check
2. All tributes not unique -> runtime check
3. No Arena -> compile time
4. No match id or matchId = "" -> runtime check
5. No seed or invalid seed (NaN) -> already thrown by createRng
6. each tributes startingWeaponDefId is valid -> runtime check
7. The arena zones are invalid -> runtime check
8. There are no arena zones -> runtime check

## Open questions
The first event of a match could carry a snapshot of the arena, so stored logs stay playable even if you later edit an arena
The time of day changes visibility, does it count as part of GameState (round -> time of day) or is it derived from round?