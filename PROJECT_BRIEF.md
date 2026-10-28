# Project Brief — "The Arena" (AI Survival Game)

> **For the AI assistant:** Read this file before any learning prompt (`/learn`, `/arch`, `/hint`, `/test`, `/code-review`, etc.). It says what is being built, what is already decided, what I know, where I want to be taught versus where I just want to ship, and **how each phase should run from start to finish** (§7). This project uses **Manware's AI Learning Toolkit**: see `CLAUDE.md` and `.claude/commands/`.
>
> **Working title.** Avoid "Hunger Games" in code, UI and branding, because it's a protected brand.

---

## 1. The game

Players each create a **tribute**, then watch AI-controlled tributes fight to survive in an arena. The last one alive wins.

| Stage | What happens |
|---|---|
| **Lobby** (multiplayer) | Players join a room and each builds one tribute. AI-generated tributes fill the empty slots (for example 12 or 24 in total) |
| **Character creation** | **Radar chart** stats with a fixed point budget (strength, agility, stealth, intelligence, endurance, charisma), a **weapon** choice, and a short **personality prompt** that really shapes behaviour. A **3D model** morphs with the stats |
| **Map selection** | For example jungle or dystopian city. Each map is a set of zones |
| **The match** | Tributes are markers moving across the map, with an **announcer feed** narrating what happens |
| **Sponsoring** | During the match, players spend limited sponsor points to send items (food, medicine, weapons), which affect later rounds |

---

## 2. Decisions already made

These are settled. Don't reopen them during normal guidance. If I run `/explore` or `/arch` and ask to challenge one, that's fine.

| Decision | Choice | Why |
|---|---|---|
| Rules vs AI | A **deterministic rules engine** (pure TypeScript, seeded) owns all truth. **LLMs only choose intent** from a fixed action menu, using structured output | The game stays fair, testable and debuggable, and the LLM can never decide outcomes |
| Action validation | The engine validates every action. Invalid or malformed choices fall back to a sensible default | This also contains prompt injection from player personality prompts |
| Time model | **Round-based** (day and night phases). Each round runs perception → decision → validation → resolution → events | LLM calls can run in parallel per round, and the flow is easy to reason about |
| Buffering | The server simulates **a few rounds ahead** of playback, not the whole match | Sponsoring needs to affect the future. Gifts apply at the next round that hasn't been simulated yet |
| Persistence | Each match is stored as a **seed plus an event log** | Allows replays and debugging |
| Narrator | A separate LLM call turns each round's events into commentary. **It's cosmetic only** | Flavour never changes state |
| Map | A **zone graph** (zones have food, water, cover, hazard and adjacency). Movement goes zone to zone, and the client interpolates | Simple to simulate. Arena events like flooding or closing zones push tributes together |
| Authority | **Server-authoritative.** The simulation and LLM calls run only on the server. Clients render events | Prevents cheating and keeps API keys secret |
| Agent memory | A short memory list per tribute that is fed back into its prompt, with a cap | Gives continuity without token costs growing |
| Order of work | **No graphics until Phase 1 is fun** | The simulation is the product. The visuals present it |

### Suggested stack (confirm in each phase's `/arch` session)

| Area | Proposal |
|---|---|
| Monorepo | **npm workspaces** (`apps/*`, `packages/*`). Turborepo can be added later if task running gets slow |
| Frontend | Next.js, TypeScript, Tailwind, Zustand. React Three Fiber and drei for 3D |
| Simulation | `packages/sim`: pure TypeScript with no framework dependencies, unit-tested |
| Server | A Node service for the game loop, LLM calls and WebSockets (library chosen in Phase 4) |
| Database | Postgres for users, lobbies and saved matches |
| 3D assets | Blender base mesh with shape keys (muscular, lean, heavy, tall) exported as glTF. Weapons attach to the hand bone |
| LLM | A fast, cheap model for decisions, and possibly a stronger one for narration |
| Deploy | Docker on Hetzner via Coolify |

---

## 3. Architecture

```
apps/web  (Next.js)  ── renders events, creator, lobby ──┐
                                                          │ WebSocket (Phase 4)
apps/server (Node)   ── game loop, LLM calls, rooms ─────┘
      │
      ├── packages/sim     ← pure rules engine (deterministic, seeded)
      ├── packages/agents  ← prompt building, schema, LLM client, fallback
      └── packages/shared  ← event + DTO types shared with the client

apps/cli (Phase 1)   ── runs packages/sim + packages/agents in the terminal
```

**Rules of the architecture:**

1. `packages/sim` has **no I/O**: no network, no LLM calls, no `Date.now()`, no `Math.random()`. All randomness comes from the seeded RNG.
2. The engine takes **decisions as input** and is unaware of the LLM. Agents produce decisions, and the engine resolves them.
3. LLM output goes through a **schema validator** before it reaches the engine. Anything else becomes the fallback action.
4. The **event log is the contract** between server and client. The client never computes game outcomes.
5. The narrator reads events and writes text. Nothing it produces goes back into the state.

---

## 4. Core concepts to design (Phase 1)

I design these myself in `/arch`. They're listed here so the assistant knows what exists, not to dictate fields.

| Concept | What it represents |
|---|---|
| `Stats` | The six attributes and the point-budget rules |
| `Weapon` | Modifiers against stats and situations |
| `Tribute` | Identity, stats, weapon, personality, health, hunger, inventory, memory, alliances, status |
| `Zone` / `Map` | The zone graph and its resources, cover, hazards and adjacency |
| `Action` | The fixed menu: `forage`, `hunt(target)`, `hide`, `rest`, `move_to(zone)`, `propose_alliance(target)`, `betray(ally)`, `flee`, `use_item(item)` |
| `GameEvent` | Everything that happened in a round, in a form both the narrator and the client can use |
| `GameState` | The full truth at a round boundary |

---

## 5. Scope

**In (across all phases):** everything in §1 and the roadmap in §7.

**Out (for now):**
- Real-time action within a round (it stays round-based)
- Players controlling their tribute directly
- Ranked matchmaking, accounts beyond the basics, monetisation
- Full 3D animated combat. Phase 5 is a 2.5D arena view
- Mobile apps

---

## 6. Open questions (good material for `/arch` and `/explore`)

- **Replay determinism:** LLM output isn't deterministic, so a replay must use the recorded decisions or events, not re-run the agents. What exactly gets stored?
- **Cost per match:** tributes × rounds × calls. What is the per-match budget, and which model gives acceptable quality at that cost?
- **LLM failure handling:** timeouts, retries, and when to give up and use the fallback action
- **Match pacing:** how many rounds, how arena events compress the late game, and how long a match lasts in real time
- **Alliances and betrayal:** how they're represented, and whether both sides have to agree
- **Personality prompt limits:** length cap and content filtering, and how much it influences behaviour versus the stats
- **Sponsor economy:** points, item costs, and limits that stop one player dominating
- **Buffer size:** how many rounds ahead, and how this feels when a sponsor gift arrives "late"
- **WebSocket library:** to be chosen in Phase 4
- **Auth:** whether guest rooms are enough at first

---

## 7. How the project progresses

### 7.1 The loop every phase follows

| Step | Toolkit | What happens |
|---|---|---|
| 1. Warm-up | `/retrieve` | At the start of a session, a short quiz on earlier phases, using `learning/` |
| 2. Design | `/arch` | I design the phase before writing code. One question at a time, and you challenge my assumptions |
| 3. New libraries | `/api` | Whenever I pick up a new library or API, before using it |
| 4. Contract first | `/test` | For engine logic: I define the contract and edge cases, then write failing tests |
| 5. Build | `/hint`, `/debug` | I implement. Hints come one level at a time, and I form a hypothesis before any debugging help |
| 6. Review | `/code-review` | I name my weakest part first, then you review, correctness before style |
| 7. Post-mortem | `/autopsy` | After any non-trivial bug. You prompt me to do this |
| 8. Stress-test | `/explore` | At the end of the phase, introduce constraints one at a time (scale, failure, cost) |
| 9. Teach back | `/explain` | I explain the phase's key concept as if to a beginner |
| 10. Log | — | Update `learning/concepts.md` and `learning/mistakes.md`, then check the phase's "done when" |

**Don't start the next phase until the current phase's "done when" is met.** If I try to skip ahead, point it out.

---

### Phase 0 — Scaffolding *(shipping mode)*

**Goal:** an npm workspaces monorepo with `apps/cli`, `packages/sim`, `packages/agents` and `packages/shared`, using TypeScript strict mode, a test runner, linting and formatting.

**Done when:** `npm test -w packages/sim` runs an empty suite, and `npm start -w apps/cli` prints "hello arena".

---

### Phase 1 — Text-only simulator (CLI)

**Goal:** a full match runs in the terminal, and *reading the log is entertaining*.

**Order:**
1. `/arch`: the data model (§4)
2. `/arch`: the shape of one round: perception → decision → validation → resolution → events
3. `/test` → build: **seeded RNG** and state setup
4. `/test` → build: **movement, hunger and resources** (no combat yet). Run a match where everyone just survives
5. `/test` → build: **combat resolution** (stats, weapon modifiers and seeded dice). Test this heavily
6. Build: **random-agent mode**, which picks valid actions at random so the engine can be tested without any LLM
7. `/api` on the LLM SDK and structured output → `/arch`: the **agent prompt and response schema**
8. Build: the **LLM decision loop** with validation and fallback. Add memory
9. Build: **arena events** (closing zones)
10. `/api` → build: the **narrator**
11. Playtest about 10 matches, then tune the numbers

**Learning focus:** deterministic simulation, seeded randomness, structured LLM output, defensive validation, prompt design.

**Done when:**
- [ ] The same seed with recorded decisions produces an identical event log
- [ ] Random-agent matches always end with exactly one survivor, with no crashes or stuck states
- [ ] Malformed or hostile LLM output (including injection in personality prompts) never breaks the engine
- [ ] Personality noticeably changes behaviour across matches
- [ ] I'd happily read a full narrated match
- [ ] I know the cost per match and have written it down

**Carry forward:** the event-log format becomes the client contract in Phase 2. Freeze it here.

---

### Phase 2 — 2D zone map and playback

**Goal:** a web UI that plays back a **stored** event log: markers move between zones while the announcer feed scrolls.

**Order:** `/arch` playback architecture (event queue, playback clock, interpolation) → render the zone graph in 2D → markers and interpolation → announcer feed synced to events → play, pause and speed controls.

**Learning focus:** turning an event stream into animation, separating playback time from simulation time, client state with Zustand.

**Shipping zone:** Next.js setup, layout and styling.

**Done when:**
- [ ] Any Phase 1 log file plays back correctly from start to finish
- [ ] The client contains **no** game logic. It only applies events

---

### Phase 3 — Character creator

**Goal:** a radar chart with a point budget, a weapon picker, and a personality prompt with limits. It outputs a valid `Tribute` config that the engine accepts.

**Order:** `/arch` validation (the client checks for UX, the server checks for real) → `/test` the point-budget rules in `shared` → an interactive radar chart → weapon picker → personality input with length cap → run a CLI match with created tributes.

**Learning focus:** validating input on both client and server with shared rules, and building an interactive custom SVG or canvas control.

**Done when:**
- [ ] It's impossible to submit an over-budget or invalid tribute, even by editing the request by hand
- [ ] A created tribute plays in a match and behaves according to its personality

---

### Phase 4 — Multiplayer lobbies and sponsoring

**Goal:** rooms, live event streaming, the round buffer and sponsor gifts. Deployed so friends can play.

**Order:** `/api` to compare WebSocket options → `/arch` rooms, the message protocol, reconnection and the buffer → server game loop wrapping `sim` and `agents` → lobby join and tribute submission → live event streaming into the Phase 2 player → sponsor actions applied at the next round boundary → Postgres for saved matches → deploy with Coolify.

**Learning focus:** server-authoritative real-time systems, protocol design, reconnection and failure modes, concurrency around round boundaries.

**Shipping zone:** Dockerfile, Coolify and Nginx config.

**`/explore` constraints to stress-test:** a player disconnecting mid-match, an LLM provider outage, two sponsor gifts racing at a round boundary, and 10 concurrent rooms.

**Done when:**
- [ ] 3 or more people on different networks play a full match with sponsoring
- [ ] A reconnecting client catches up from the event log
- [ ] Saved matches replay in the Phase 2 player

---

### Phase 5 — 3D

**Goal:** a morphing character in the creator, then a 2.5D arena view.

**Order:** `/api` on React Three Fiber and drei → load the glTF model and drive shape keys from stats in the creator → attach weapons to the hand bone → `/arch` the 2.5D arena (camera, zone layout, marker → model) → swap the 2D renderer for 3D, still driven by the same events.

**Learning focus:** glTF, morph targets and shape keys, skeletons and bone attachment, R3F's render loop, keeping 3D a pure view layer.

**Shipping zone:** Blender export settings and asset-pipeline glue.

**Done when:**
- [ ] Changing stats morphs the model smoothly
- [ ] The 3D arena plays the same event logs as the 2D view, without any changes to `sim`

---

## 8. About me (learner profile)

- **Role:** Junior frontend developer, with about 1.5 years in React/JavaScript and about 1 year in WordPress/PHP
- **Strong in:** React, Next.js, TypeScript, Tailwind. Some Three.js
- **Infrastructure:** I self-host on a Hetzner VPS with Coolify, Docker and Nginx
- **New to:** game simulation design, LLM agent loops, real-time multiplayer, 3D character morphing
- **Pitch level:** someone who knows the web stack well but hasn't built games. Relate new ideas to web concepts where possible. For example: the event log is like a Redux action log, the round buffer is like prefetching, and server authority is like never trusting the client in a form submit.

---

## 9. How to guide me

### Learning zones (toolkit rules — I try first, I predict, hints one level at a time)

- The simulation engine, combat rules, seeded RNG and game-state types
- The agent decision loop: prompt, schema, validation, fallback, memory
- The event-log format and the playback and animation logic
- The multiplayer protocol, rooms, buffering and sponsor timing
- Shape-key morphing and how the 3D view consumes events
- Any bug I hit: `/debug`, then `/autopsy` if it was non-trivial

### Shipping zones (give me a working answer when I say "ship this")

- Project scaffolding, config files, linting and formatting
- Docker, Coolify and Nginx deploy config
- Boilerplate UI components and styling
- Asset-pipeline glue and Blender export settings

### Style

- **One question at a time.** Don't front-load long explanations.
- Begin every phase with `/arch` and every new library with `/api`.
- Keep me to the roadmap. If I start on graphics before Phase 1's "done when" is met, say so.
- Flag these immediately, even in shipping mode: game logic leaking into the client or narrator, non-determinism inside `sim`, unvalidated LLM output reaching the engine, API keys reaching the client.
- Point me to official docs when relevant.

---

## 10. Conventions

- **Language:** TypeScript strict mode everywhere
- **Package manager:** npm workspaces. Internal packages are referenced with `"*"` (for example `"@arena/sim": "*"`), and scripts are run per package with `-w` (for example `npm test -w packages/sim`). Every package declares the dependencies it imports, even if they'd resolve from the root anyway
- **Packages:** `@arena/sim`, `@arena/agents`, `@arena/shared`
- **Randomness:** only through the seeded RNG passed into the engine
- **Events:** past tense, serialisable, versioned (for example `TributeAttacked`, `ZoneClosed`)
- **Tests:** engine rules are tested before they're implemented. Every bug fix gets a regression test
- **Commits:** small, one concern each, with a message saying *why*
- **Learning logs:** the `learning/` folder. Update it at the end of every phase and after each `/autopsy`