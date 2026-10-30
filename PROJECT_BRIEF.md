# Project Brief — "The Arena" (AI Survival Game)

> **For the AI assistant:** Read this file before any learning prompt (`/learn`, `/arch`, `/hint`, `/test`, `/code-review`, etc.). It says what is being built, what is already decided, how multiplayer works (§5), what I know, where I want to be taught versus where I just want to ship, and **how each phase should run from start to finish** (§8). This project uses **Manware's AI Learning Toolkit**: see `CLAUDE.md` and `.claude/commands/`.
>
> **Working title.** Avoid "Hunger Games" in code, UI and branding, because it's a protected brand.

---

## 1. The game

Players each create a **tribute**, then watch AI-controlled tributes fight to survive in an arena. The last one alive wins. It's a **multiplayer** game: several people join the same match, each with their own tribute, and watch and sponsor together.

| Stage | What happens |
|---|---|
| **Lobby** (multiplayer) | Players join a room and each builds one tribute. AI-generated tributes fill the empty slots (for example 12 or 24 in total) |
| **Character creation** | **Radar chart** stats with a fixed point budget (strength, agility, stealth, intelligence, endurance, charisma), a **weapon** choice, and a short **personality prompt** that really shapes behaviour. A **3D model** morphs with the stats |
| **Map selection** | For example jungle or dystopian city. Each map is a set of zones |
| **The match** | Every player in the room watches the same match live. Tributes are markers moving across the map, with an **announcer feed** narrating what happens |
| **Sponsoring** | During the match, players spend limited sponsor points to send items (food, medicine, weapons) to any tribute, which affect later rounds |

---

## 2. Decisions already made

These are settled. Don't reopen them during normal guidance. If I run `/explore` or `/arch` and ask to challenge one, that's fine.

| Decision | Choice | Why |
|---|---|---|
| Rules vs AI | A **deterministic rules engine** (pure TypeScript, seeded) owns all truth. **LLMs only choose intent** from a fixed action menu, using structured output | The game stays fair, testable and debuggable, and the LLM can never decide outcomes |
| Action validation | The engine validates every action. Invalid or malformed choices fall back to a sensible default | This also contains prompt injection from player personality prompts |
| Time model | **Round-based** (day and night phases). Each round runs perception → decision → validation → resolution → events | LLM calls can run in parallel per round, and the flow is easy to reason about |
| Buffering | The server simulates **a few rounds ahead** of playback, not the whole match | Sponsoring needs to affect the future. Gifts apply at the next round that hasn't been simulated yet |
| Persistence | Each match is stored as a **seed plus an event log** | Allows replays, debugging and reconnect catch-up |
| Narrator | A separate LLM call turns each round's events into commentary. **It's cosmetic only** | Flavour never changes state |
| Map | A **zone graph** (zones have food, water, cover, hazard and adjacency). Movement goes zone to zone, and the client interpolates | Simple to simulate. Arena events like flooding or closing zones push tributes together |
| **Multiplayer** | **Designed in from Phase 1, built in Phase 4.** Several players share one match in a room, and each human player owns one tribute | Adding multiplayer to an engine that assumed a single player later is painful |
| **Real-time transport** | **WebSockets using the `ws` library.** Clients send commands, and the server pushes room state and game events | Two-way, low latency, one connection per player. `ws` is minimal, so I build rooms, broadcasting, heartbeats and reconnection myself, which is where the learning is |
| **Security** | **Arcjet** for rate limiting, bot protection and Shield (attack detection) on HTTP routes and the WebSocket upgrade request | Every match costs LLM money, so unlimited room creation or tribute spam is a direct cost risk. Arcjet handles this at the edge of the app, before game code runs |
| Authority | **Server-authoritative.** The simulation and LLM calls run only on the server. Clients send *requests* and render events | Prevents cheating, keeps every player in sync, and keeps API keys secret |
| Agent memory | A short memory list per tribute that is fed back into its prompt, with a cap | Gives continuity without token costs growing |
| Order of work | **No graphics until Phase 1 is fun** | The simulation is the product. The visuals present it |

### Suggested stack (confirm in each phase's `/arch` session)

| Area | Proposal |
|---|---|
| Monorepo | **npm workspaces** (`apps/*`, `packages/*`). Turborepo can be added later if task running gets slow |
| Frontend | Next.js, TypeScript, Tailwind, Zustand. React Three Fiber and drei for 3D |
| Simulation | `packages/sim`: pure TypeScript with no framework dependencies, unit-tested |
| Server | A Node service for the game loop, LLM calls and rooms, with `ws` attached to its HTTP server |
| Security SDKs | `@arcjet/next` in the web app, `@arcjet/node` in the game server. The Arcjet key stays server-side |
| Message validation | A schema library such as Zod in `packages/shared`, used by both client and server |
| Database | Postgres for users, rooms and saved matches |
| 3D assets | Blender base mesh with shape keys (muscular, lean, heavy, tall) exported as glTF. Weapons attach to the hand bone |
| LLM | A fast, cheap model for decisions, and possibly a stronger one for narration |
| Deploy | Docker on Hetzner via Coolify. Nginx must be configured to allow WebSocket upgrades |

---

## 3. Architecture

```
 Player A browser ─┐
 Player B browser ─┼── WebSocket ──┐
 Player C browser ─┘               │
                                   ▼
apps/web  (Next.js)          apps/server (Node)
 renders events,              ├─ RoomManager (rooms in memory)
 creator, lobby               ├─ Room: lobby → match loop → finished
                              ├─ uses packages/sim + packages/agents
                              └─ writes events to Postgres
      │
      ├── packages/sim     ← pure rules engine (deterministic, seeded)
      ├── packages/agents  ← prompt building, schema, LLM client, fallback
      └── packages/shared  ← event types, protocol messages + schemas, tribute validation

apps/cli (Phase 1)   ── runs packages/sim + packages/agents in the terminal
```

**Rules of the architecture:**

1. `packages/sim` has **no I/O**: no network, no LLM calls, no `Date.now()`, no `Math.random()`. All randomness comes from the seeded RNG.
2. The engine takes **decisions and sponsor gifts as input** and is unaware of the LLM and the network. Agents produce decisions, players produce gifts, and the engine resolves both.
3. LLM output goes through a **schema validator** before it reaches the engine. Anything else becomes the fallback action.
4. The **event log is the contract** between server and client. The client never computes game outcomes.
5. **Every message from a client is untrusted.** It's validated against a schema in `shared`, then checked against the room's rules (is this player in the room, can they afford the gift, is the match running).
6. The narrator reads events and writes text. Nothing it produces goes back into the state.
7. **Two layers of protection.** Arcjet guards the doors (HTTP routes and the WebSocket upgrade): request rate limits, bots, and common attacks. The game server guards everything after that: message schemas, room rules, and per-connection message rate limits. Arcjet doesn't replace validation, and validation doesn't replace Arcjet.

---

## 4. Core concepts to design (Phase 1)

I design these myself in `/arch`. They're listed here so the assistant knows what exists, not to dictate fields.

| Concept | What it represents |
|---|---|
| `Stats` | The six attributes and the point-budget rules |
| `Weapon` | Modifiers against stats and situations |
| `Tribute` | Identity, **owner (a player or AI)**, stats, weapon, personality, health, hunger, inventory, memory, alliances, status |
| `Zone` / `Map` | The zone graph and its resources, cover, hazards and adjacency |
| `Action` | The fixed menu: `forage`, `hunt(target)`, `hide`, `rest`, `move_to(zone)`, `propose_alliance(target)`, `betray(ally)`, `flee`, `use_item(item)` |
| `SponsorGift` | Who sent what to whom, and which round it applies to |
| `GameEvent` | Everything that happened in a round, with a **sequence number**, in a form both the narrator and the client can use |
| `GameState` | The full truth at a round boundary |

Later concepts (Phase 4): `Room`, `Player`, and the protocol messages in §5.

---

## 5. Multiplayer

### 5.1 The model

A **room** holds one match. Players join a room, build their tributes, and watch the same match together.

| Room status | What's happening | What players can do |
|---|---|---|
| `lobby` | Waiting for players | Join, leave, pick a map (host) |
| `creating` | Players build tributes | Submit tribute, mark ready |
| `running` | The match is simulating and playing | Watch, send sponsor gifts |
| `finished` | A winner exists | Watch the replay, start a new room |

**Roles:**
- **Host:** the player who created the room. Picks the map and starts the match
- **Player:** owns one tribute and has sponsor points
- **Spectator** (later): watches only

When the match starts, AI-generated tributes fill the empty slots.

### 5.2 How a match stays in sync

```
server:  simulate round N+3 ──> events (seq 412–440) ──broadcast──> all clients in room
client:  receives events, queues them, plays them back at viewing speed (round N)
player:  sends sponsor gift ──> server validates ──> applied at the first unsimulated round ──> ack: "applies in round N+4"
```

- The server owns the **only** game state. Clients hold just a playback queue and their own UI state.
- Every event has a **sequence number** per match. Clients remember the last one they received.
- **Reconnecting:** the client sends its last sequence number, and the server replays the events it missed from the log. The same mechanism lets a late joiner catch up.
- **Sponsor timing:** a gift can never change a round that has already been simulated. The server tells the player which round it will apply to, so the UI can show "arriving in round 12".
- **Pacing:** all players watch the match at the same pace, which the server controls. Individual players can't pause it.

### 5.3 Protocol (categories — I design the exact shapes in Phase 4's `/arch`)

| Direction | Message types |
|---|---|
| Client → server | join room, leave room, submit tribute, ready, start match (host), send sponsor gift, resume from sequence number |
| Server → client | room state, player joined or left, match started, event batch, sponsor gift accepted or rejected, match finished, error |

All messages are defined as schemas in `packages/shared` and carry a **protocol version**.

Because `ws` only provides raw connections, these are mine to build on the server: the room registry and broadcasting to a room, message parsing and routing, heartbeat (ping/pong) to detect dead connections, the resume-from-sequence handshake, and a per-connection limit on how many messages a client can send.

### 5.4 Security

| Layer | Protects | How |
|---|---|---|
| Arcjet in the web app (`@arcjet/next`) | Room creation, tribute submission, any other API routes | Rate limits per IP or user, bot protection, Shield |
| Arcjet in the game server (`@arcjet/node`) | The HTTP upgrade request that opens a WebSocket | Check before accepting the upgrade, and reject with an HTTP error if denied |
| Game server | Every message on an open socket | Schema validation, room rules, per-connection message rate limit, max message size |
| Limits that protect cost | LLM spend | Max active rooms, max rooms per player, personality prompt length cap |

Arcjet works per *request*, and once a WebSocket is open, messages are no longer HTTP requests. That's why the per-message checks belong to the game server.

### 5.5 Failure cases to design for

- A player disconnects in the middle of a match (their tribute keeps playing, because the AI controls it)
- The host leaves (host passes to another player, or the room continues without one)
- An LLM call times out or the provider is down (fallback actions keep the match going)
- Two sponsor gifts arrive at the same moment at a round boundary
- The server restarts mid-match (resume from the event log in Postgres, or end the match cleanly)
- A client sends a forged or malformed message
- A client floods messages, or a script opens many connections

### 5.6 Scaling path (build each step only when it's needed)

1. **One Node process** holds all rooms in memory, and events are written to Postgres as they happen
2. **Several rooms at once** on the same process, with per-room limits on LLM calls
3. **More than one server process:** sticky sessions per room, or Redis pub/sub between processes

### 5.7 How earlier phases prepare for multiplayer

| Phase | What it must already do so multiplayer slots in later |
|---|---|
| 1 | Tributes have an `owner`. Events have a match ID and sequence number and are serialisable. Sponsor gifts are already an engine input, testable from the CLI |
| 2 | The playback client reads from an **event source interface**: a log file now, a WebSocket later, with no other changes |
| 3 | Tribute validation lives in `shared`, so the server can re-check every submission |

---

## 6. Scope

**In (across all phases):** everything in §1, multiplayer as described in §5, and the roadmap in §8.

**Out (for now):**
- Real-time action within a round (it stays round-based)
- Players controlling their tribute directly
- Ranked matchmaking, public room browsing, accounts beyond the basics, monetisation
- Text chat between players
- Full 3D animated combat. Phase 5 is a 2.5D arena view
- Mobile apps

---

## 7. Open questions (good material for `/arch` and `/explore`)

- **Replay determinism:** LLM output isn't deterministic, so a replay must use the recorded decisions or events, not re-run the agents. What exactly gets stored?
- **Cost per match:** tributes × rounds × calls. What is the per-match budget, and which model gives acceptable quality at that cost?
- **LLM failure handling:** timeouts, retries, and when to give up and use the fallback action
- **Match pacing:** how many rounds, how arena events compress the late game, and how long a match lasts in real time
- **Alliances and betrayal:** how they're represented, and whether both sides have to agree
- **Personality prompt limits:** length cap and content filtering, and how much it influences behaviour versus the stats
- **Sponsor economy:** points, item costs, and limits that stop one player dominating. Can players sponsor rival tributes?
- **Buffer size:** how many rounds ahead, and how this feels when a sponsor gift arrives "late"
- **Room size:** maximum human players per room, and how AI tributes fill the rest
- **Joining:** invite links or room codes, and whether late joiners can enter a running match as spectators
- **Arcjet rule values:** how many rooms per player per hour, how strict bot protection should be for a game where some "players" may be friends on unusual networks
- **Identifying players for rate limits:** IP address at first, or a guest ID once players have one
- **Identity:** whether guest players with a display name are enough at first

---

## 8. How the project progresses

### 8.1 The loop every phase follows

| Step | Toolkit | What happens |
|---|---|---|
| 1. Warm-up | `/retrieve` | At the start of a session, a short quiz on earlier phases, using `learning/` |
| 2. Design | `/arch` | I design the phase before writing code. One question at a time, and you challenge my assumptions |
| 3. New libraries | `/api` | Whenever I pick up a new library or API, before using it |
| 4. Contract first | `/test` | For engine and protocol logic: I define the contract and edge cases, then write failing tests |
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
1. `/arch`: the data model (§4), including tribute owners, sequence-numbered events and sponsor gifts (§5.7)
2. `/arch`: the shape of one round: perception → decision → validation → resolution → events
3. `/test` → build: **seeded RNG** and state setup
4. `/test` → build: **movement, hunger and resources** (no combat yet). Run a match where everyone just survives
5. `/test` → build: **combat resolution** (stats, weapon modifiers and seeded dice). Test this heavily
6. Build: **random-agent mode**, which picks valid actions at random so the engine can be tested without any LLM
7. `/test` → build: **sponsor gifts as engine input**. A CLI flag can inject a gift at a given round
8. `/api` on the LLM SDK and structured output → `/arch`: the **agent prompt and response schema**
9. Build: the **LLM decision loop** with validation and fallback. Add memory
10. Build: **arena events** (closing zones)
11. `/api` → build: the **narrator**
12. Playtest about 10 matches, then tune the numbers

**Learning focus:** deterministic simulation, seeded randomness, structured LLM output, defensive validation, prompt design.

**Done when:**
- [ ] The same seed with recorded decisions and gifts produces an identical event log
- [ ] Random-agent matches always end with exactly one survivor, with no crashes or stuck states
- [ ] Malformed or hostile LLM output (including injection in personality prompts) never breaks the engine
- [ ] A gift injected from the CLI changes the outcome of later rounds, and never earlier ones
- [ ] Personality noticeably changes behaviour across matches
- [ ] I'd happily read a full narrated match
- [ ] I know the cost per match and have written it down

**Carry forward:** the event-log format becomes the client contract in Phase 2 and the multiplayer stream in Phase 4. Freeze it here.

---

### Phase 2 — 2D zone map and playback

**Goal:** a web UI that plays back a **stored** event log: markers move between zones while the announcer feed scrolls.

**Order:** `/arch` playback architecture (event source interface, event queue, playback clock, interpolation) → render the zone graph in 2D → markers and interpolation → announcer feed synced to events → play, pause and speed controls.

**Learning focus:** turning an event stream into animation, separating playback time from simulation time, client state with Zustand, designing an interface so the data source can change later.

**Shipping zone:** Next.js setup, layout and styling.

**Done when:**
- [ ] Any Phase 1 log file plays back correctly from start to finish
- [ ] The client contains **no** game logic. It only applies events
- [ ] Events come in through an event source interface that a WebSocket could implement later

---

### Phase 3 — Character creator

**Goal:** a radar chart with a point budget, a weapon picker, and a personality prompt with limits. It outputs a valid `Tribute` config that the engine accepts.

**Order:** `/arch` validation (the client checks for UX, the server checks for real) → `/test` the point-budget rules in `shared` → an interactive radar chart → weapon picker → personality input with length cap → run a CLI match with created tributes.

**Learning focus:** validating input on both client and server with shared rules, and building an interactive custom SVG or canvas control.

**Done when:**
- [ ] It's impossible to submit an over-budget or invalid tribute, even by editing the request by hand
- [ ] A created tribute plays in a match and behaves according to its personality

---

### Phase 4 — Multiplayer

Split into three parts. Each one is playable before the next starts.

#### 4a — Rooms and a shared live match

**Order:** `/api` on `ws` (what it gives you, and what it deliberately doesn't) → `/arch` rooms, room statuses, roles and the protocol (§5.1, §5.3) → `/test` message schemas and room rules in `shared` → the `ws` server attached to the Node HTTP server, with the `RoomManager`, message routing and heartbeat → lobby UI: create room, join with a code, submit tribute, ready → the server match loop wrapping `sim` and `agents` → stream event batches into the Phase 2 player through the event source interface.

**Done when:**
- [ ] 2 or more browsers join one room, submit tributes and watch the same match in sync
- [ ] Forged or malformed messages are rejected without affecting the room

#### 4b — Sponsoring and the round buffer

**Order:** `/arch` the buffer and sponsor timing (§5.2) → `/test` gift validation and round assignment → send-gift UI with sponsor points → server acknowledgement showing which round it applies to.

**Done when:**
- [ ] A gift from any player applies at the correct round, and every player sees it happen
- [ ] Two gifts sent at the same moment are both handled correctly

#### 4c — Resilience, persistence and deploy

**Order:** reconnection from the last sequence number → host leaving → events saved to Postgres as they happen → saved matches replayable → `/api` on Arcjet → `/arch` where each protection sits (§5.4) → Arcjet on the web app's routes and on the WebSocket upgrade → per-connection message rate limit and max message size in the game server → `/explore` the failure cases in §5.5 → deploy with Coolify, including Nginx WebSocket upgrades.

**Done when:**
- [ ] 3 or more people on different networks play a full match with sponsoring
- [ ] Refreshing the page mid-match catches the client up without losing anything
- [ ] Saved matches replay in the Phase 2 player
- [ ] An LLM outage mid-match degrades to fallback actions instead of crashing the room
- [ ] Creating rooms in a loop from a script gets blocked by Arcjet before any LLM call is made
- [ ] A client flooding messages on an open socket gets limited or disconnected, and the room carries on

**Learning focus:** server-authoritative real-time systems, WebSockets with `ws`, protocol design, reconnection and failure modes, concurrency around round boundaries, layered security.

**Shipping zone:** Dockerfile, Coolify and Nginx config.

---

### Phase 5 — 3D

**Goal:** a morphing character in the creator, then a 2.5D arena view.

**Order:** `/api` on React Three Fiber and drei → load the glTF model and drive shape keys from stats in the creator → attach weapons to the hand bone → `/arch` the 2.5D arena (camera, zone layout, marker → model) → swap the 2D renderer for 3D, still driven by the same events.

**Learning focus:** glTF, morph targets and shape keys, skeletons and bone attachment, R3F's render loop, keeping 3D a pure view layer.

**Shipping zone:** Blender export settings and asset-pipeline glue.

**Done when:**
- [ ] Changing stats morphs the model smoothly
- [ ] The 3D arena plays the same event logs and live multiplayer streams as the 2D view, without any changes to `sim`

---

## 9. About me (learner profile)

- **Role:** Junior frontend developer, with about 1.5 years in React/JavaScript and about 1 year in WordPress/PHP
- **Strong in:** React, Next.js, TypeScript, Tailwind. Some Three.js
- **Infrastructure:** I self-host on a Hetzner VPS with Coolify, Docker and Nginx
- **New to:** game simulation design, LLM agent loops, real-time multiplayer and WebSockets, Arcjet and application security, 3D character morphing
- **Pitch level:** someone who knows the web stack well but hasn't built games. Relate new ideas to web concepts where possible. For example: the event log is like a Redux action log, the round buffer is like prefetching, server authority is like never trusting the client in a form submit, and a WebSocket is like an HTTP request that stays open so the server can push to you.

---

## 10. How to guide me

### Learning zones (toolkit rules — I try first, I predict, hints one level at a time)

- The simulation engine, combat rules, seeded RNG and game-state types
- The agent decision loop: prompt, schema, validation, fallback, memory
- The event-log format and the playback and animation logic
- Multiplayer: rooms, the WebSocket protocol on `ws`, heartbeats, message validation, sync, reconnection, buffering and sponsor timing
- Security design: what Arcjet protects, what the game server must protect itself, and why
- Shape-key morphing and how the 3D view consumes events
- Any bug I hit: `/debug`, then `/autopsy` if it was non-trivial

### Shipping zones (give me a working answer when I say "ship this")

- Project scaffolding, config files, linting and formatting
- Docker, Coolify and Nginx deploy config (including WebSocket upgrade headers)
- Arcjet installation and environment setup, once I've designed where the rules go
- Boilerplate UI components and styling, including lobby layout
- Asset-pipeline glue and Blender export settings

### Style

- **One question at a time.** Don't front-load long explanations.
- Begin every phase with `/arch` and every new library with `/api`.
- Keep me to the roadmap. If I start on graphics before Phase 1's "done when" is met, or on multiplayer before Phase 3's, say so.
- Flag these immediately, even in shipping mode: game logic leaking into the client or narrator, non-determinism inside `sim`, unvalidated LLM output reaching the engine, client messages trusted without validation, API keys (LLM or Arcjet) reaching the client, routes or the WebSocket upgrade left without Arcjet protection.
- Point me to official docs when relevant.

---

## 11. Conventions

- **Language:** TypeScript strict mode everywhere
- **Package manager:** npm workspaces. Internal packages are referenced with `"*"` (for example `"@arena/sim": "*"`), and scripts are run per package with `-w` (for example `npm test -w packages/sim`). Every package declares the dependencies it imports, even if they'd resolve from the root anyway
- **Packages:** `@arena/sim`, `@arena/agents`, `@arena/shared`
- **Randomness:** only through the seeded RNG passed into the engine
- **Events:** past tense, serialisable, versioned, with a match ID and sequence number (for example `TributeAttacked`, `ZoneClosed`)
- **Protocol messages:** defined as schemas in `shared`. Client commands are imperative (`JoinRoom`, `SendSponsorGift`), server messages describe what happened (`PlayerJoined`, `GiftAccepted`). The protocol carries a version number
- **Tests:** engine rules and room rules are tested before they're implemented. Every bug fix gets a regression test
- **Commits:** small, one concern each, with a message saying *why*
- **Learning logs:** the `learning/` folder. Update it at the end of every phase and after each `/autopsy`