# Project Brief — "The Arena" (AI Survival Game)

> **For the AI assistant:** Read this file before any learning prompt (`/learn`, `/arch`, `/hint`, `/test`, `/code-review`, etc.). It says what is being built, what is already decided, how solo and multiplayer work (§5), what I know, where I want to be taught versus where I just want to ship, and **how each phase should run from start to finish** (§8). This project uses **Manware's AI Learning Toolkit**: see `CLAUDE.md` and `.claude/commands/`.
>
> **Working title.** Avoid "Hunger Games" in code, UI and branding, because it's a protected brand.

---

## 1. The game

Players each create a **tribute**, then watch AI-controlled tributes fight to survive in an arena. The last one alive wins. There are two modes:

- **Solo:** one player and their tribute against 7 AI-generated tributes
- **Multiplayer:** several people join the same match, each with their own tribute, and watch and sponsor together. AI-generated tributes fill the empty slots

| Stage | What happens |
|---|---|
| **Landing** | The player enters a guest display name and chooses **Play solo**, **Create lobby** or **Join with a code** |
| **Lobby** (multiplayer only) | Players join a room and each builds one tribute. AI-generated tributes fill the empty slots (12 or 24 in total) |
| **Character creation** | A name, a cosmetic **origin**, **radar chart** stats with a 36-point budget and a maximum of 10 per stat (strength, agility, stealth, intelligence, endurance, charisma), a **weapon** choice, and a **personality prompt** of up to 280 characters that really shapes behaviour |
| **Map selection** | One of four maps, each a set of zones with its own hazards (§2, Hazards) |
| **The match** | The player, or every player in the room, watches the match live in an arena view that switches between **top-down** and **2.5D** cameras. An **announcer feed** narrates what happens |
| **Sponsoring** | During the match, players spend sponsor points to send items (food, water, medicine, ammunition) to any tribute. **Gifts are used the moment they land**, so the player sees the effect in the promised round. Ammunition can only be sent to a tribute holding the matching weapon. Players earn more points for every day their tribute survives |
| **After elimination** | A player whose tribute dies can keep watching and sponsoring, or leave |
| **Results** | Final placements, the player's own result, key moments, and every tribute's personality prompt revealed |

---

## 2. Decisions already made

These are settled. Don't reopen them during normal guidance. If I run `/explore` or `/arch` and ask to challenge one, that's fine.

| Decision | Choice | Why |
|---|---|---|
| Rules vs AI | A **deterministic rules engine** (pure TypeScript, seeded) owns all truth. **LLMs only choose intent** from a fixed action menu, using structured output | The game stays fair, testable and debuggable, and the LLM can never decide outcomes |
| Action validation | The engine validates every action. Invalid or malformed choices fall back to a sensible default | This also contains prompt injection from player personality prompts |
| Time model | **Round-based** (day and night phases). Each round runs perception → decision → validation → resolution → events | LLM calls can run in parallel per round, and the flow is easy to reason about |
| Time in the UI | **Everything is expressed in rounds.** Countdowns use rounds ("sealing in 2 rounds"), and any arena clock time shown is derived from the round | The UI can never promise a timing the engine doesn't have |
| Buffering | The server simulates **a few rounds ahead** of playback, not the whole match | Sponsoring needs to affect the future. Gifts apply at the next round that hasn't been simulated yet |
| Gift timing in the UI | **The UI always shows the exact round a gift lands in** ("lands round 9"), never "next round". The "simulating next round" screen only appears if the buffer runs out | Buffered rounds may already be simulated, so "next round" would often be wrong |
| Persistence | Each match is stored as a **seed plus an event log** | Allows replays, debugging and reconnect catch-up |
| Narrator | A separate LLM call turns each round's events into commentary. **It's cosmetic only** | Flavour never changes state |
| Map | A **zone graph** (zones have food, water, cover, hazards and adjacency). Movement goes zone to zone, and the client interpolates | Simple to simulate. Arena events like closing zones push tributes together |
| Maps | **Four maps:** Sector Nine (city, 7 zones), The Verdance (jungle, 6), Whiteout (glacier, 8) and Glass Flats (desert, 5). Each map favours certain stats through its zones and hazards | Map choice is a real strategic decision when building a tribute |
| Visibility | **There are no visibility hazards.** Visibility is handled by each zone's cover stat | Avoids a second system that does the same job |
| **Hazards** | **Every hazard damages health,** and there are two kinds. **Map-wide hazards** hit every tribute for lower damage. **Zone hazards** hit only tributes in one zone for higher damage. Hazards are data in each map's definition, and each hit emits a `HazardStruck` event | One simple, data-driven system covers all four maps |
| Zone closures | **Zone closures stay a separate arena event** from hazards. A closed zone is sealed for the rest of the match, while a zone hazard is temporary damage | Closures drive the late game, and hazards add danger along the way |
| **Weapons** | **Five weapons:** machete, recurve bow, spear, throwing knives and crowbar. The bow and throwing knives use **ammunition**. Each weapon's damage scales with one stat. When a tribute is killed, **the killer takes the victim's weapon with its remaining ammunition**. Thrown spears, supply caches and the snare kit are out of scope | Each weapon suits a different build, without extra systems to build and test |
| Origin | **Cosmetic only** | Flavour for the tribute, with no effect on the rules |
| **Relationships** | **Grudges and feelings** ("fears Dax", "distrusts Reva") **come from the agent's response,** based on events the tribute saw. They're fed back into its prompt and shown in the UI. **The engine ignores them** | Adds character without letting the LLM change game state |
| **Hidden prompts** | **Every tribute's personality prompt, other than the player's own, is hidden until the match ends.** The server doesn't send them to clients before then | A rival's prompt would reveal their strategy. Hiding it in the UI alone isn't enough |
| **Game modes** | **Solo** (one player plus 7 AI tributes) **is built first, in Phase 4. Multiplayer** (AI fills the empty slots) **follows in Phase 5** | Solo gives a complete, playable game before the extra work of rooms and syncing players |
| **Match loop** | **One match loop serves both modes**, kept separate from room logic. Solo has one connection, and rooms later broadcast the same stream to several | Avoids maintaining two versions of the game |
| **Solo pacing** | **Solo players can pause and change playback speed.** While paused, the server stops simulating ahead | There's only one viewer to keep in sync, and stopping the simulation avoids wasting LLM calls |
| **Maps across modes** | **Solo and multiplayer use the same maps.** Each map lists its starting zones by hand (`startingZoneIds`, chosen in or next to a central zone), and zones close based on how many tributes are alive per open zone, not on a fixed round | One set of maps and rules works at 8, 12 or 24 tributes, and the action starts early even at 8 |
| **Arena view** | **One arena scene with two cameras:** top-down and 2.5D. It's built with React Three Fiber and an orthographic camera, with tribute markers as HTML overlays. Switching camera animates the same scene | The design treats 2D and 2.5D as one scene, so building them separately would mean doing the work twice |
| **Map layout data** | **Each map has viewer-only layout data** (zone shapes, labels, building heights), keyed by zone ID and kept separate from the rules definition | The engine stays abstract, and the visuals can change without touching `sim` |
| **Tribute positions** | **The client picks a repeatable, cosmetic spot within a zone** for each tribute | The engine only knows which zone a tribute is in |
| **Multiplayer** | **Designed in from Phase 1, built in Phase 5.** Several players share one match in a room, and each human player owns one tribute | Adding multiplayer to an engine that assumed a single player later is painful |
| **Real-time transport** | **WebSockets using the `ws` library, in both modes.** Clients send commands, and the server pushes state and game events | Two-way, low latency, one connection per player. `ws` is minimal, so I build rooms, broadcasting, heartbeats and reconnection myself, which is where the learning is |
| **Security** | **No third-party security service at first.** Spending limits, Nginx request and connection limits, an `Origin` check on the WebSocket upgrade, and validation in the game server | Every match costs LLM money, so unlimited match creation, room creation or tribute spam is a direct cost risk. A hard budget holds even if a bot gets through, and I learn more by building this myself. If bots become a problem, add a CAPTCHA such as Cloudflare Turnstile before match creation, or reconsider a service then |
| Identity | **Guest display names at first,** with no sign-in | Accounts aren't needed to play, and can be added later |
| Authority | **Server-authoritative in both modes.** The simulation and LLM calls run only on the server. Clients send *requests* and render events | Prevents cheating, keeps every player in sync, and keeps API keys secret |
| Agent memory | A short memory list per tribute that is fed back into its prompt, with a cap | Gives continuity without token costs growing |
| Order of work | **No graphics until Phase 1 is fun** | The simulation is the product. The visuals present it |

### Suggested stack (confirm in each phase's `/arch` session)

| Area | Proposal |
|---|---|
| Monorepo | **npm workspaces** (`apps/*`, `packages/*`). Turborepo can be added later if task running gets slow |
| Frontend | Next.js, TypeScript, Tailwind, Zustand. React Three Fiber and drei for the arena view (from Phase 2) and the character model (Phase 6) |
| Simulation | `packages/sim`: pure TypeScript with no framework dependencies, unit-tested |
| Maps | Pure data, kept in `packages/shared` (`arenas.ts`) for now. Each map has a rules definition (zones, adjacency, resources, cover, hazards, starting zones) and separate layout data for the viewer. Move it into its own package only if `shared` gets crowded |
| Server | A Node service for the game loop, LLM calls and rooms, with `ws` attached to its HTTP server |
| Message validation | A schema library such as Zod in `packages/shared`, used by both client and server |
| Database | Postgres for rooms and saved matches |
| 3D assets | Blender base mesh with shape keys (muscular, lean, heavy, tall) exported as glTF. Weapons attach to the hand bone |
| LLM | A fast, cheap model for decisions, and possibly a stronger one for narration |
| Deploy | Docker on Hetzner via Coolify. Nginx must be configured to allow WebSocket upgrades |

---

## 3. Architecture

```
 Solo player browser ──────┐
 Player A browser ─┐       │
 Player B browser ─┼── WebSocket ──┐
 Player C browser ─┘               │
                                   ▼
apps/web  (Next.js)          apps/server (Node)
 arena view (R3F),            ├─ Match loop (shared by both modes, no room logic)
 creator, lobby               ├─ Solo: one connection → match loop → finished
                              ├─ RoomManager (rooms in memory)
                              ├─ Room: lobby → match loop → finished
                              ├─ uses packages/sim + packages/agents
                              └─ writes events to Postgres
      │
      ├── packages/sim     ← pure rules engine (deterministic, seeded)
      ├── packages/agents  ← prompt building, schema, LLM client, fallback, relationship tags
      └── packages/shared  ← event types, protocol messages + schemas, tribute validation,
                             map rules definitions (arenas.ts, for sim)

Map layout data (viewer only) lives with the web app, kept apart from the rules definitions.

apps/cli (Phase 1)   ── runs packages/sim + packages/agents in the terminal
```

**Rules of the architecture:**

1. `packages/sim` has **no I/O**: no network, no LLM calls, no `Date.now()`, no `Math.random()`. All randomness comes from the seeded RNG.
2. The engine takes **the map definition, decisions and sponsor gifts as input** and is unaware of the LLM and the network. Agents produce decisions, players produce gifts, and the engine resolves both.
3. LLM output goes through a **schema validator** before it reaches the engine. Anything else becomes the fallback action.
4. The **event log is the contract** between server and client. The client never computes game outcomes.
5. **Every message from a client is untrusted.** It's validated against a schema in `shared`, then checked against the match or room rules (does this player belong to the match, can they afford the gift, is the match running).
6. The narrator reads events and writes text. Nothing it produces goes back into the state.
7. **Three layers of protection.** Nginx guards the doors: request and connection limits. The game server guards everything after that: the `Origin` check on the WebSocket upgrade, message schemas, match and room rules, and per-connection message rate limits. Spending limits sit behind both, so LLM costs stay capped even if the other layers are bypassed.
8. **The match loop knows nothing about rooms.** It runs a match and emits events to whoever is connected. Solo and multiplayer differ only in how a match is set up and how many connections receive its events.
9. **`sim` never reads layout data.** Layout is for the viewer only. A test checks that every map's layout covers exactly the zones in its rules definition.
10. **Relationship tags never reach the engine.** They live in `agents` and the event stream for display only.
11. **Personality prompts stay on the server until the match ends,** except a player's own. The server sends them all with the match-finished message.

---

## 4. Core concepts to design (Phase 1)

I design these myself in `/arch`. They're listed here so the assistant knows what exists, not to dictate fields.

| Concept | What it represents |
|---|---|
| `Stats` | The six attributes, the 36-point budget and the maximum of 10 per stat |
| `Weapon` | Modifiers against stats and situations, plus **ammunition** (bow, throwing knives) |
| `Item` | Sponsor gifts (ration pack, water flask, medkit, arrows, throwing knives) are applied on arrival and never stored. Ammunition adds to the matching weapon's count. Inventories hold only weapons, which is what a killer loots |
| `Tribute` | Identity, cosmetic origin, **owner (a player or AI)**, stats, weapon, personality, health, hunger, inventory, memory, alliances, status |
| `Zone` / `Map` | The zone graph and its resources, **cover**, hazards and adjacency |
| `Hazard` | Map-wide (lower damage to every tribute) or zone (higher damage to one zone), and when it triggers |
| `Action` | The fixed menu: `forage`, `hunt(target)`, `hide`, `rest`, `move_to(zone)`, `propose_alliance(target)`, `betray(ally)`, `flee`. |
| `SponsorGift` | Who sent what to whom, and which round it applies to |
| `GameEvent` | Everything that happened in a round, with a **sequence number**, in a form both the narrator and the client can use |
| `GameState` | The full truth at a round boundary |
| Match setup | The seed, map definition and **tribute count**, which is configurable so the engine handles both 8-tribute and 12–24-tribute matches |

Agent-side, not engine: **relationship tags** returned with each decision, based on events the tribute saw.

Later concepts: map layout data (Phase 2), the server match loop (Phase 4), then `Room`, `Player`, and the rest of the protocol messages in §5 (Phase 5).

---

## 5. Solo and multiplayer

Both modes use the same engine, agents, maps, event log and match loop.

| | Solo | Multiplayer |
|---|---|---|
| **Tributes** | 1 player tribute plus 7 AI tributes | One per human player, with AI filling the empty slots (12 or 24 in total) |
| **Setup** | Play solo → create a tribute → pick a map → start | Join a room, then follow the room statuses in §5.1 |
| **Connections** | One | One per player |
| **Pacing** | The player can pause and change playback speed | The server sets one pace for everyone, with a countdown to the next round |
| **After elimination** | Keep watching and sponsoring, or leave, which ends the match | Keep watching and sponsoring as a spectator, or leave while the match continues |
| **Built in** | Phase 4 | Phase 5 |

In both modes, players watch and sponsor. They never control a tribute directly.

### 5.1 The multiplayer model

A **room** holds one match. Players join a room, build their tributes, and watch the same match together. There's no text chat.

| Room status | What's happening | What players can do |
|---|---|---|
| `lobby` | Waiting for players | Join, leave, pick a map and tribute count (host) |
| `creating` | Players build tributes | Submit tribute, mark ready |
| `running` | The match is simulating and playing | Watch, send sponsor gifts |
| `finished` | A winner exists | See results, start a new room |

**Roles:**
- **Host:** the player who created the room. Picks the map and tribute count, and starts the match
- **Player:** owns one tribute and has sponsor points
- **Spectator** (later): watches only

When the match starts, AI-generated tributes fill the empty slots.

### 5.2 How a match stays in sync

```
server:  simulate round N+3 ──> events (seq 412–440) ──send──> every connected client (one in solo)
client:  receives events, queues them, plays them back at viewing speed (round N)
player:  sends sponsor gift ──> server validates ──> applied at the first unsimulated round ──> ack: "lands round N+4"
```

- The server owns the **only** game state. Clients hold just a playback queue and their own UI state.
- Every event has a **sequence number** per match. Clients remember the last one they received.
- **Reconnecting:** the client sends its last sequence number, and the server replays the events it missed from the log. The same mechanism lets a late joiner catch up.
- **Sponsor timing:** a gift can never change a round that has already been simulated. The server tells the player which round it will land in, and the UI shows that exact round.
- **Running out of buffer:** if playback catches up with the simulation, the client shows the "simulating next round" screen until events arrive.
- **Multiplayer pacing:** all players watch the match at the same pace, which the server controls. Individual players can't pause it.
- **Solo pacing:** the player can pause and change playback speed. While paused, the server stops simulating ahead, so no LLM calls are wasted.

### 5.3 Protocol (categories — I design the exact shapes in `/arch`: the solo messages in Phase 4, the room messages in Phase 5)

| Direction | Solo and shared messages (Phase 4) | Room messages (Phase 5) |
|---|---|---|
| Client → server | start solo match, pause, set playback speed, send sponsor gift, leave match | join room, leave room, submit tribute, ready, start match (host), resume from sequence number |
| Server → client | match started, event batch, sponsor gift accepted or rejected, match finished (with all personality prompts), error | room state, player joined or left |

All messages are defined as schemas in `packages/shared` and carry a **protocol version**.

Because `ws` only provides raw connections, these are mine to build on the server. In Phase 4: message parsing and routing, heartbeat (ping/pong) to detect dead connections, and a per-connection limit on how many messages a client can send. In Phase 5: the room registry and broadcasting to a room, and the resume-from-sequence handshake.

### 5.4 Security

| Layer | Protects | How |
|---|---|---|
| Nginx | HTTP routes and the requests that open WebSockets | `limit_req` for request rates and `limit_conn` for connections per IP |
| Game server, at the upgrade | The HTTP upgrade request that opens a WebSocket | Check the `Origin` header before accepting the upgrade, and reject with an HTTP error if it's wrong |
| Game server, on open sockets | Every message on an open socket | Schema validation, match and room rules, per-connection message rate limit, max message size using `maxPayload` in `ws` |
| Game server, outgoing | Hidden information | Other tributes' personality prompts aren't sent until the match ends |
| Spending limits | LLM spend | Daily LLM budget, max active matches and rooms, max solo matches and rooms per player, personality prompt length cap, and a spending limit with the LLM provider if it offers one |

Nginx works per *request and connection*, and once a WebSocket is open, messages are no longer HTTP requests. That's why the per-message checks belong to the game server. The spending limits are the real protection for LLM costs, because they hold even if a bot gets through.

**If bots become a problem:** add a CAPTCHA such as Cloudflare Turnstile before match creation, or reconsider a service like Arcjet.

### 5.5 Failure cases to design for

- A solo player disconnects in the middle of a match (the server shouldn't keep spending LLM money with nobody watching)
- A multiplayer player disconnects in the middle of a match (their tribute keeps playing, because the AI controls it)
- The host leaves (host passes to another player, or the room continues without one)
- An LLM call times out or the provider is down (fallback actions keep the match going)
- Two sponsor gifts arrive at the same moment at a round boundary
- Playback catches up with the simulation (show the "simulating next round" screen)
- The server restarts mid-match (resume from the event log in Postgres, or end the match cleanly)
- A client sends a forged or malformed message
- A client floods messages, or a script opens many connections

### 5.6 Scaling path (build each step only when it's needed)

1. **One Node process** holds all solo matches and rooms in memory, and events are written to Postgres as they happen
2. **Several matches and rooms at once** on the same process, with per-match limits on LLM calls
3. **More than one server process:** sticky sessions per match or room, or Redis pub/sub between processes

### 5.7 How earlier phases prepare for solo and multiplayer

| Phase | What it must already do so later modes slot in |
|---|---|
| 1 | Tributes have an `owner`. Events have a match ID and sequence number and are serialisable. Sponsor gifts are already an engine input, testable from the CLI. **The tribute count is configurable, and matches work at both 8 and 12–24 tributes** |
| 2 | The arena view reads from an **event source interface**: a log file now, a WebSocket later, with no other changes |
| 3 | Tribute validation lives in `shared`, so the server can re-check every submission |
| 4 | The match loop has no knowledge of rooms and sends events to its connections, so multiplayer can add more connections without changing it |

---

## 6. Scope

**In (across all phases):** everything in §1, solo and multiplayer as described in §5, responsive layouts for desktop and mobile web, and the roadmap in §8.

**Out (for now):**
- Real-time action within a round (it stays round-based)
- Players controlling their tribute directly
- Text chat between players, including the lobby
- Public live matches, scheduled broadcasts and watching other people's matches from the landing page
- Sign-in and accounts beyond guest display names
- The snare kit, thrown spears and supply caches
- Visibility hazards (zone cover handles visibility)
- Ranked matchmaking, public room browsing, monetisation
- Full 3D animated combat. The arena is a top-down and 2.5D view
- Mobile apps

---

## 7. Open questions (good material for `/arch` and `/explore`)

- **Replay determinism:** LLM output isn't deterministic, so a replay must use the recorded decisions or events, not re-run the agents. What exactly gets stored?
- **Cost per match:** tributes × rounds × calls, at both 8 and 12–24 tributes. What is the per-match budget, and which model gives acceptable quality at that cost?
- **LLM failure handling:** timeouts, retries, and when to give up and use the fallback action
- **Match pacing:** how many rounds, how arena events compress the late game, and how long a match lasts in real time
- **Solo match length:** how long an 8-tribute match should last in real time
- **Zone closures:** how many tributes alive per open zone should trigger a closure, and whether that value works at both 8 and 12–24 tributes
- **Glass Flats at 24 tributes:** whether 5 zones is too crowded, or whether that suits a fast, open map
- **Hazard values:** damage for map-wide and zone hazards, how often they trigger, and whether some only trigger by day or night
- **Weapons:** ammunition amounts, and whether each weapon's power and stat suit its role
- **Alliances and betrayal:** how they're represented, and whether both sides have to agree
- **Relationship tags:** the allowed set of tags, how many a tribute can hold, and how they fade
- **Personality prompt content:** content filtering, and how much the prompt influences behaviour versus the stats
- **Sponsor economy:** points earned per day survived, item costs, and limits that stop one player dominating
- **Buffer size:** how many rounds ahead, and how this feels when a sponsor gift lands later than expected
- **Room size:** maximum human players per room, and how AI tributes fill the rest
- **Joining:** invite links or room codes, and whether late joiners can enter a running match as spectators
- **Limit values:** the daily LLM budget, max active matches, how many solo matches and rooms per player per hour, and Nginx limits that won't block friends sharing a network
- **Identifying players for rate limits:** IP address at first, or a guest ID once players have one
- **Arena view on mobile:** whether React Three Fiber performs well enough on a mid-range phone, and what to simplify if it doesn't

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

**Goal:** a full match runs in the terminal on any of the four maps, at both 8 and 12–24 tributes, and *reading the log is entertaining*.

**Order:**
1. `/arch`: the data model (§4), including tribute owners, a configurable tribute count, weapons and ammunition, hazards, sequence-numbered events and sponsor gifts (§5.7)
2. `/arch`: the shape of one round: perception → decision → validation → resolution → events
3. `/test` → build: **seeded RNG** and state setup
4. `/test` → build: **movement, hunger, resources and cover** on Sector Nine (no combat yet). Run a match where everyone just survives
5. `/test` → build: **combat resolution** (stats, weapon modifiers, ammunition, looting and seeded dice). Test this heavily
6. Build: **random-agent mode**, which picks valid actions at random so the engine can be tested without any LLM
7. `/test` → build: **sponsor gifts as engine input**. A CLI flag can inject a gift at a given round
8. `/api` on the LLM SDK and structured output → `/arch`: the **agent prompt and response schema**, including relationship tags
9. Build: the **LLM decision loop** with validation and fallback. Add memory and relationship tags
10. Build: **arena events**: zones closing based on tributes alive per open zone, and **map-wide and zone hazards** from the map definition, emitting `HazardStruck`
11. Add the other three maps as data in `packages/shared` (`arenas.ts`), each with hand-picked `startingZoneIds`
12. `/api` → build: the **narrator**
13. Playtest about 10 matches across both sizes and all four maps, then tune the numbers. Random-agent matches can test how often tributes meet at each size, and how deadly each map's hazards are, without any LLM cost

**Learning focus:** deterministic simulation, seeded randomness, data-driven rules, structured LLM output, defensive validation, prompt design.

**Done when:**
- [ ] The same seed with recorded decisions and gifts produces an identical event log
- [ ] Random-agent matches on all four maps at both 8 and 12–24 tributes always end with exactly one survivor, with no crashes or stuck states
- [ ] Malformed or hostile LLM output (including injection in personality prompts) never breaks the engine
- [ ] A gift injected from the CLI changes the outcome of later rounds, and never earlier ones
- [ ] Ammunition runs out, and a killer takes the victim's weapon with its remaining ammunition
- [ ] Personality noticeably changes behaviour across matches
- [ ] I'd happily read a full narrated match at either size
- [ ] I know the cost per match at both sizes and have written it down

**Carry forward:** the event-log format becomes the client contract in Phase 2, the live stream in Phase 4 and the multiplayer stream in Phase 5. Freeze it here.

---

### Phase 2 — Arena view and playback

**Goal:** a web UI that plays back a **stored** event log in one arena scene with top-down and 2.5D cameras: markers move between zones while the announcer feed scrolls.

**Order:** `/api` on React Three Fiber and drei → `/arch` playback architecture (event source interface, event queue, playback clock, interpolation, seeking) and the arena scene (layout data, cameras, marker overlays) → layout data for Sector Nine, with the test that it matches the map definition → render the zones flat with the top-down camera → tribute markers as HTML overlays, with cosmetic positions within each zone and interpolation → announcer feed synced to events → closures and hazards shown on the map → play, pause, speed and seeking to a sequence number → the 2.5D camera, building heights and an animated camera switch → layout data for the other three maps.

**Learning focus:** turning an event stream into animation, separating playback time from simulation time, rebuilding state by replaying events, client state with Zustand, orthographic cameras and scenes in React Three Fiber, designing an interface so the data source can change later.

**Shipping zone:** Next.js setup, layout and styling.

**Done when:**
- [ ] Any Phase 1 log file plays back correctly from start to finish, on any map
- [ ] Switching between top-down and 2.5D animates the same scene, without restarting playback
- [ ] Seeking to any point shows the correct state
- [ ] The client contains **no** game logic. It only applies events
- [ ] Events come in through an event source interface that a WebSocket could implement later
- [ ] It runs smoothly on a mid-range phone

---

### Phase 3 — Character creator

**Goal:** a name, a cosmetic origin, a radar chart with a 36-point budget, a weapon picker with the five weapons, and a personality prompt of up to 280 characters. It outputs a valid `Tribute` config that the engine accepts. The character preview is a static figure until Phase 6.

**Order:** `/arch` validation (the client checks for UX, the server checks for real) → `/test` the point-budget and prompt rules in `shared` → an interactive radar chart → weapon picker → personality input with length cap → run a CLI match with created tributes.

**Learning focus:** validating input on both client and server with shared rules, and building an interactive custom SVG or canvas control.

**Done when:**
- [ ] It's impossible to submit an over-budget or invalid tribute, even by editing the request by hand
- [ ] A created tribute plays in a match and behaves according to its personality

---

### Phase 4 — Solo play

**Goal:** the complete game in the browser: one player chooses Play solo, creates a tribute, picks a map, watches a live match against 7 AI tributes, sponsors during it and sees the results.

Split into three parts. Each one is playable before the next starts.

#### 4a — A live solo match

**Order:** `/api` on `ws` (what it gives you, and what it deliberately doesn't) → `/arch` the match loop, its separation from rooms (§3, §5.7) and the solo protocol (§5.3) → `/test` message schemas and solo match rules in `shared` → the `ws` server attached to the Node HTTP server, with message routing and heartbeat → landing page with guest name and Play solo → solo setup: create tribute, pick map, start → the server match loop wrapping `sim` and `agents`, filling the 7 AI slots → stream event batches into the arena view through the event source interface → pause and playback speed, with simulation stopping while paused → the "simulating next round" screen when the buffer runs out → keep watching or leave after elimination → results screen, revealing every personality prompt.

**Done when:**
- [ ] One player can go from the landing page to a full live match against 7 AI tributes in the browser, and see the results
- [ ] While the match is paused, no new rounds are simulated and no LLM calls are made
- [ ] Other tributes' personality prompts never reach the client before the match ends
- [ ] Forged or malformed messages are rejected without affecting the match
- [ ] The match loop contains no room logic

#### 4b — Sponsoring and the round buffer

**Order:** `/arch` the buffer, sponsor timing and points earned per day survived (§5.2) → `/test` gift validation and round assignment → send-gift UI with sponsor points → server acknowledgement showing the exact round the gift lands in.

**Done when:**
- [ ] A gift lands in the round the UI promised, and the player sees it happen
- [ ] A gift sent while the match is paused still lands in the correct round
- [ ] Sponsor points increase for each day the player's tribute survives

#### 4c — Protection and deploy

**Order:** `/arch` where each protection sits (§5.4) → spending limits → `Origin` check on the WebSocket upgrade → per-connection message rate limit and max message size in the game server → solo disconnect handling → `/explore` the solo failure cases in §5.5 → deploy with Coolify, including Nginx WebSocket upgrades, `limit_req` and `limit_conn`.

**Done when:**
- [ ] Someone on a different network can play a full solo match with sponsoring
- [ ] An LLM outage mid-match degrades to fallback actions instead of crashing the match
- [ ] A disconnected solo player's match stops spending LLM money
- [ ] Creating solo matches in a loop from a script gets blocked by the limits before any LLM call is made
- [ ] No new match can start once the daily LLM budget is reached
- [ ] A WebSocket upgrade from the wrong `Origin` is rejected
- [ ] A client flooding messages on an open socket gets limited or disconnected

**Learning focus:** server-authoritative real-time systems, WebSockets with `ws`, protocol design, separating playback from simulation on the server, hiding information from clients, layered security.

**Shipping zone:** Dockerfile, Coolify and Nginx config.

---

### Phase 5 — Multiplayer

**Goal:** several players share one match in a room, with AI tributes filling the empty slots. It runs on the same match loop as solo.

Split into three parts. Each one is playable before the next starts.

#### 5a — Rooms and a shared live match

**Order:** `/arch` rooms, room statuses, roles and the room protocol (§5.1, §5.3) → `/test` message schemas and room rules in `shared` → the `RoomManager` and broadcasting to a room → Create lobby and Join with a code on the landing page → lobby UI: room code, player slots, host controls, submit tribute, ready → connect rooms to the existing match loop, with AI filling the empty slots → the countdown to the next round.

**Done when:**
- [ ] 2 or more browsers join one room, submit tributes and watch the same match in sync
- [ ] Forged or malformed messages are rejected without affecting the room
- [ ] Solo still works, on the same match loop

#### 5b — Shared sponsoring

**Order:** `/arch` sponsoring with several players (§5.2) → `/test` simultaneous gifts and round assignment → show every player's gifts to the whole room.

**Done when:**
- [ ] A gift from any player lands in the promised round, and every player sees it happen
- [ ] Two gifts sent at the same moment are both handled correctly

#### 5c — Resilience and persistence

**Order:** reconnection from the last sequence number → host leaving → events saved to Postgres as they happen → saved matches replayable, with Watch replay and jumping to key moments from the results screen → extend the Nginx and spending limits to room routes (§5.4) → `/explore` the failure cases in §5.5 → update the deployment.

**Done when:**
- [ ] 3 or more people on different networks play a full match with sponsoring
- [ ] Refreshing the page mid-match catches the client up without losing anything
- [ ] Saved matches, solo and multiplayer, replay in the arena view, and key moments jump to the right point
- [ ] An LLM outage mid-match degrades to fallback actions instead of crashing the room
- [ ] Creating rooms in a loop from a script gets blocked by the limits before any LLM call is made
- [ ] A client flooding messages on an open socket gets limited or disconnected, and the room carries on

**Learning focus:** broadcasting and room management, keeping several clients in sync, reconnection and failure modes, concurrency around round boundaries.

**Shipping zone:** deployment config changes.

---

### Phase 6 — Character model and arena polish

**Goal:** a morphing 3D character in the creator, replacing the static figure, and visual polish for the arena.

**Order:** load the glTF model and drive shape keys from stats in the creator → attach weapons to the hand bone → hazard and closure effects in the arena → optionally, small tribute models in the 2.5D view, still driven by the same events.

**Learning focus:** glTF, morph targets and shape keys, skeletons and bone attachment, keeping 3D a pure view layer.

**Shipping zone:** Blender export settings and asset-pipeline glue.

**Done when:**
- [ ] Changing stats morphs the model smoothly
- [ ] The arena still plays the same event logs and live solo and multiplayer streams, without any changes to `sim`
- [ ] It still runs smoothly on a mid-range phone

---

## 9. About me (learner profile)

- **Role:** Junior frontend developer, with about 1.5 years in React/JavaScript and about 1 year in WordPress/PHP
- **Strong in:** React, Next.js, TypeScript, Tailwind. Some Three.js
- **Infrastructure:** I self-host on a Hetzner VPS with Coolify, Docker and Nginx
- **New to:** game simulation design, LLM agent loops, real-time multiplayer and WebSockets, application security, React Three Fiber scenes, 3D character morphing
- **Pitch level:** someone who knows the web stack well but hasn't built games. Relate new ideas to web concepts where possible. For example: the event log is like a Redux action log, the round buffer is like prefetching, server authority is like never trusting the client in a form submit, and a WebSocket is like an HTTP request that stays open so the server can push to you.

---

## 10. How to guide me

### Learning zones (toolkit rules — I try first, I predict, hints one level at a time)

- The simulation engine, combat rules, weapons, hazards, seeded RNG and game-state types
- The agent decision loop: prompt, schema, validation, fallback, memory, relationship tags
- The event-log format, playback, seeking and the arena scene
- Solo play: the server match loop, the WebSocket protocol on `ws`, heartbeats, message validation, buffering, pausing, sponsor timing and hidden prompts
- Multiplayer: rooms, broadcasting, sync and reconnection
- Security design: what Nginx protects, what the game server must protect itself, how spending limits cap LLM costs, and why
- Shape-key morphing and how the 3D view consumes events
- Any bug I hit: `/debug`, then `/autopsy` if it was non-trivial

### Shipping zones (give me a working answer when I say "ship this")

- Project scaffolding, config files, linting and formatting
- Docker, Coolify and Nginx deploy config (including WebSocket upgrade headers)
- Nginx `limit_req` and `limit_conn` config, once I've designed the limits
- Boilerplate UI components and styling, including lobby layout and responsive layouts
- Map layout data entry, once I've designed its shape
- Asset-pipeline glue and Blender export settings

### Style

- **One question at a time.** Don't front-load long explanations.
- Begin every phase with `/arch` and every new library with `/api`.
- Keep me to the roadmap. If I start on graphics before Phase 1's "done when" is met, on solo play before Phase 3's, or on multiplayer before Phase 4's, say so.
- Flag these immediately, even in shipping mode: game logic leaking into the client or narrator, room logic leaking into the match loop, `sim` reading layout data, relationship tags reaching the engine, non-determinism inside `sim`, unvalidated LLM output reaching the engine, client messages trusted without validation, other tributes' personality prompts sent to a client before the match ends, API keys reaching the client, match or room creation without spending limits, the WebSocket upgrade left without an `Origin` check.
- Point me to official docs when relevant.

---

## 11. Conventions

- **Language:** TypeScript strict mode everywhere
- **Package manager:** npm workspaces. Internal packages are referenced with `"*"` (for example `"@arena/sim": "*"`), and scripts are run per package with `-w` (for example `npm test -w packages/sim`). Every package declares the dependencies it imports, even if they'd resolve from the root anyway
- **Packages:** `@arena/sim`, `@arena/agents`, `@arena/shared`
- **Naming:** "map" in this brief means "arena" in code (`ArenaDefinition`, `arenaId`, `arenaDefinitions`)
- **Randomness:** only through the seeded RNG passed into the engine
- **Events:** past tense, serialisable, versioned, with a match ID and sequence number (for example `TributeAttacked`, `ZoneClosed`, `HazardStruck`)
- **Protocol messages:** defined as schemas in `shared`. Client commands are imperative (`JoinRoom`, `SendSponsorGift`), server messages describe what happened (`PlayerJoined`, `GiftAccepted`). The protocol carries a version number
- **Tests:** engine rules and room rules are tested before they're implemented. Every bug fix gets a regression test
- **Commits:** small, one concern each, with a message saying *why*
- **Learning logs:** the `learning/` folder. Update it at the end of every phase and after each `/autopsy`