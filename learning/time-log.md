# Time Log

Budget: **250 hours** by 2026-12-31.

## MVP checkpoints (planned 2026-11-12)

Check this against the log at the end of each week. The **hours** column is the real check; the dates assume the remaining hours are spread evenly to the end of December.

| Part | Est. hours | Running total by end | Aim to finish by | Actual date | Actual total |
| ---- | ---------- | -------------------- | ---------------- | ----------- | ------------ |
| P1 step 9: LLM loop | 14 | ~104 | Mon 17 Nov | | |
| P1 step 10: alliances | 10 | ~114 | Thu 20 Nov | | |
| P1 step 11: arena events and hazards | 9 | ~123 | Sun 23 Nov | | |
| P1 step 12: four arenas as rules data | 4 | ~127 | Mon 24 Nov | | |
| P1 step 13: narrator | 6 | ~133 | Wed 26 Nov | | |
| P1 step 14: playtest, tuning, cost per match | 7 | ~140 | **Sat 29 Nov (Phase 1 done)** | | |
| P2a: Glass Flats scene and playback | 27 | ~167 | Sun 7 Dec | | |
| P2b: console look, hazards, performance | 16 | ~183 | Thu 11 Dec | | |
| P3: creator | 10 | ~193 | Sun 14 Dec | | |
| P4a: live solo match | 22 | ~215 | Fri 19 Dec | | |
| P4b: sponsoring and round buffer | 10 | ~225 | Mon 22 Dec | | |
| P4c: protection and deploy | 12 | ~237 | **Fri 26 Dec (MVP live)** | | |
| Buffer | ~13 | 250 | 27–31 Dec | | |

**If a checkpoint slips** by more than 2 days or about 10% of its hours: move the next non-core part into shipping mode (Phase 3 first, then 2b polish such as wobble and haze, then 4b's UI). **If Phase 1 isn't done by about 3 Dec:** discuss moving the date into early January or cutting 2b to flat shading.

## Daily log

- **Hours:** total time worked that day, tracked manually (start/end or a rough total). This is the number that counts against the budget.
- **With Claude:** lower-bound estimate of time spent in Claude Code sessions, from `npm run time` (gaps over 15 min count as breaks). It misses time coding, reading or thinking without messaging.
- **Progress:** phase and step reached by the end of the day.

| Date       | Hours | With Claude | Progress                                          | Notes |
| ---------- | ----- | ----------- | ------------------------------------------------- | ----- |
| 2026-10-16 |   8   | 3.7         | Phase 1 design: invariants, data model            |       |
| 2026-10-17 |   7   | 3.0         | Phase 0 scaffold, sanitisePersonality             |       |
| 2026-10-28 |   7   | 2.3         | Data model aligned with multiplayer               |       |
| 2026-10-30 |   8   | 3.2         | Seeded RNG                                        |       |
| 2026-11-02 |   10  | 7.0         | RNG fixes, match setup /arch                      |       |
| 2026-11-04 |   7   | 3.1         | createMatch done (step 3), step 4 /arch           |       |
| 2026-11-05 |   6.5 | 2.5         | resolveRound: initiative + forage                 |       |
| 2026-11-06 |   7   | 2.4         | resolveRound: check + weapon                      |       |
| 2026-11-07 |   0   | 0.0         | resolveRound: hit + damage                        |       |
| 2026-11-08 |   4   | 1.4         | resolveRound: death + safety                      |       |
| 2026-11-09 |   8   | 3.9         | random agents arch and perceive tests             |       |
| 2026-11-10 |   9.5 | 5.6         | match end and match loop                          |       |
| 2026-11-11 |   8   | 3.4         | match end and match loop                          |       |

**Running total:** 90 / 250 hours (to 2026-11-11)
