# Project Brief — "The Arena" (AI Survival Game)

> **For the AI assistant:** Read this file before any learning prompt (`/learn`, `/arch`, `/hint`, `/test`, `/code-review`, etc.). It says what is being built, what is already decided, how solo and multiplayer work (§5), how accounts, membership and monetisation work (§6), what I know, where I want to be taught versus where I just want to ship, and **how each phase should run from start to finish** (§9). This project uses **Manware's AI Learning Toolkit**: see `CLAUDE.md` and `.claude/commands/`.
>
> **Working title.** Avoid "Hunger Games" in code, UI and branding, because it's a protected brand.
>
> **Companion documents** (in `docs/`): the design boards (`The Arena (1).html`), the Glass Flats 3D prototype (`Glass Flats 3D.html`) and the *3D Arena Cheat Sheet* (`The Arena — 3D Arena Cheat Sheet.pdf`). Where they disagree with this brief, **this brief wins** (see §2, Tribute positions: match data never carries x/y coordinates).

---

## 1. The game

Players each create a **tribute**, then watch AI-controlled tributes fight to survive in a fully 3D arena. The last one alive wins. There are two modes:

- **Solo:** one player and their tribute against 7 AI-generated tributes. **Solo is the MVP**, built as a vertical slice on one arena, Glass Flats (§9.2)
- **Multiplayer (add-on):** several people join the same match, each with their own tribute, and watch and sponsor together. AI-generated tributes fill the empty slots. Built on top of the finished solo game

The table below describes the full game. **The MVP leaves out:** the other three arenas in 3D and the 2D fallback map (Phase 5), saved matches and replays (Phase 6), the morphing 3D character model (Phase 7), accounts and membership (Phase 8) and rooms (Phase 9).

| Stage | What happens |
|---|---|
| **Landing** | The player enters a guest display name and chooses **Play solo**, **Create lobby** or **Join with a code**. Signed-in players see how much of today's match allowance is left, and their plan |
| **Lobby** (multiplayer only) | Players join a room and each builds one tribute. AI-generated tributes fill the empty slots (12 or 24 in total) |
| **Character creation** | A name, a cosmetic **origin**, **radar chart** stats with a 36-point budget and a maximum of 10 per stat (strength, agility, stealth, intelligence, endurance, charisma), a **weapon** choice, and a **personality prompt** of up to 280 characters that really shapes behaviour. A **3D figure** of the tribute morphs as the stats change (Phase 7; a low-poly placeholder figure until then) |
| **Arena selection** | One of four arenas, each a set of zones with its own hazards (§2, Hazards). Glass Flats only until Phase 5 |
| **Loading** | A per-arena loading screen while the 3D scene builds and its shaders compile |
| **The match** | The player, or every player in the room, watches the match live in a **3D arena**. The camera switches between the **Broadcast** view (perspective, the default) and the **Overhead** view (orthographic, straight down, which is the game's "2D map"), with Ground and Follow-my-tribute presets. Devices without WebGL, or too slow for the 3D scene, get a **2D map** instead (Phase 5). An **announcer feed** narrates what happens |
| **Tribute detail** | Clicking a tribute opens its health, hunger, stats, weapon and ammunition, inventory, memory, and alliances and grudges. Its personality prompt is shown only if it's the player's own |
| **Sponsoring** | During the match, players spend sponsor points to send items (food, water, medicine, ammunition) to any tribute. **Gifts are used the moment they land**, so the player sees the effect in the promised round. Ammunition can only be sent to a tribute holding the matching weapon. Players earn more points for every day their tribute survives |
| **After elimination** | A player whose tribute dies can keep watching and sponsoring, or leave |
| **Results** | Final placements, the player's own result, and every tribute's personality prompt revealed. Key moments that jump into the replay come with replays (Phase 6) |
| **Allowance and membership** | Watching is free, and everyone gets a small daily allowance of matches they start (in the MVP). A monthly **Supporter** membership through Clerk Billing, adding more matches and extras that never affect who wins, comes later and only if it's needed to cover LLM costs (Phase 8, §6) |

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
| Arenas | **Four arenas:** Sector Nine (city, 7 zones), The Verdance (jungle, 6), Whiteout (glacier, 8) and Glass Flats (desert, 5). Each arena favours certain stats through its zones and hazards | Arena choice is a real strategic decision when building a tribute |
| Visibility | **There are no visibility hazards.** Visibility is handled by each zone's cover stat | Avoids a second system that does the same job |
| **Hazards** | **Every hazard damages health,** and there are two kinds. **Map-wide hazards** hit every tribute for lower damage. **Zone hazards** hit only tributes in one zone for higher damage. Hazards are data in each arena's rules definition, and each hit emits a `HazardStruck` event | One simple, data-driven system covers all four arenas |
| Zone closures | **Zone closures stay a separate arena event** from hazards. A closed zone is sealed for the rest of the match, while a zone hazard is temporary damage | Closures drive the late game, and hazards add danger along the way |
| **Weapons** | **Five weapons:** machete, recurve bow, spear, throwing knives and crowbar. The bow and throwing knives use **ammunition**. Each weapon's damage scales with one stat. When a tribute is killed, **the killer takes the victim's weapon with its remaining ammunition**. Thrown spears, supply caches and the snare kit are out of scope | Each weapon suits a different build, without extra systems to build and test |
| Origin | **Cosmetic only** | Flavour for the tribute, with no effect on the rules |
| **Relationships** | **Grudges and feelings** ("fears Dax", "distrusts Reva") **come from the agent's response,** based on events the tribute saw. They're fed back into its prompt and shown in the UI. **The engine ignores them** | Adds character without letting the LLM change game state |
| **Hidden prompts** | **Every tribute's personality prompt, other than the player's own, is hidden until the match ends.** The server doesn't send them to clients before then | A rival's prompt would reveal their strategy. Hiding it in the UI alone isn't enough |
| **Game modes** | **Solo** (one player plus 7 AI tributes) **is built first, as the MVP**: the engine (Phase 1), Glass Flats in 3D (Phase 2), the creator (Phase 3) and live solo play (Phase 4). **Multiplayer** (AI fills the empty slots) **is an add-on in Phase 9** | A complete, playable solo game comes before the extra work of rooms and syncing players |
| **Vertical slice** | **The MVP is built end to end on one arena, Glass Flats,** before the other three get their 3D scenes (Phase 5). The rules data for all four arenas is still done in Phase 1 | Problems with the event format, playback and the live stream show up early, while they're cheap to fix, and the game is playable sooner |
| **Match loop** | **One match loop serves both modes**, kept separate from room logic. Solo has one connection, and rooms later broadcast the same stream to several | Avoids maintaining two versions of the game |
| **Solo pacing** | **Solo players can pause and change playback speed.** While paused, the server stops simulating ahead | There's only one viewer to keep in sync, and stopping the simulation avoids wasting LLM calls |
| **Arenas across modes** | **Solo and multiplayer use the same arenas.** Each arena lists its starting zones by hand (`startingZoneIds`, chosen in or next to a central zone), and zones close based on how many tributes are alive per open zone, not on a fixed round | One set of arenas and rules works at 8, 12 or 24 tributes, and the action starts early even at 8 |
| **Arena view** | **Every arena is a fully modelled 3D scene** in Three.js, built with React Three Fiber and drei. **One scene, several cameras:** **Broadcast** (perspective, orbiting, the default), **Overhead** (orthographic, straight down — this *is* the 2D view), plus **Ground** and **Follow my tribute** presets. Switching camera animates within the same scene and never restarts playback. Tribute and zone labels are HTML overlays | One scene to build and maintain. The overhead view stays readable like a map while sharing every asset with the 3D view |
| **2D map fallback** (Phase 5) | **The 3D scene is the only arena view for devices that can run it.** Devices without WebGL, or that stay too slow after quality has stepped down to its lowest level, get a **flat 2D map** (SVG). It is drawn from the **same arena visual config** (zone function, boundaries, labels) and the **same state rebuilt from events**, with the same tribute chips and positions. It shows zones, closures, active hazards and tributes, and nothing the 3D view doesn't | Nobody is locked out of a match. Reusing the visual config and event state keeps the fallback cheap, so it doesn't become a second renderer to maintain |
| **Visual style** | A **PS2-era console look** for every arena: low-poly, flat-shaded geometry with one colour per face, a low-resolution render target scaled up with nearest-neighbour filtering, a 15-bit Bayer dither, vertex wobble, fog, and heat haze where the arena calls for it. `prefers-reduced-motion` turns off auto-orbit, haze and weather motion. **The Glass Flats prototype is the reference** for the look and the numbers | Distinctive, cheap to render on phones, and forgiving of simple geometry |
| **Arena visual config** | **Each arena has a viewer-only visual config** (zone shape function, heightfield, face colours, zone boundaries, labels, props, day and night lighting, look settings and hazard visuals), keyed by zone ID and kept in the web app, separate from the rules definition. Scene components read the config and **never mention an arena by name** | The engine stays abstract, a new arena is mostly data, and the visuals can change without touching `sim` |
| **Lighting** | **Lighting follows the round's day or night phase,** taken from events. Each arena config defines both, around the arena's signature mood (Sector Nine's night, Glass Flats' midday) | The scene shows the engine's time, not its own clock |
| **Hazard visuals** | **Hazard and closure visuals are driven by events,** never by timers. Each hazard has one effect that reads at a glance from both the Broadcast and Overhead cameras, fading in and out over about 0.8 seconds | The client shows what the engine said happened, nothing more |
| **Tribute positions** | **The engine only knows which zone a tribute is in.** The browser picks a repeatable, cosmetic spot inside that zone's shape (a seeded hash of tribute ID and zone ID, checked against the zone function) and places it on the heightfield. The 2D fallback map uses the same spot. Match data never carries x/y coordinates | Coordinates are a viewer concern. This overrides the cheat sheet's "x/y in map % from match data" and its "the same zone function drives the game rules" |
| **Multiplayer** | **Designed in from Phase 1, built in Phase 9.** Several players share one match in a room, and each human player owns one tribute | Adding multiplayer to an engine that assumed a single player later is painful |
| **Real-time transport** | **WebSockets using the `ws` library, in both modes.** Clients send commands, and the server pushes state and game events | Two-way, low latency, one connection per player. `ws` is minimal, so I build rooms, broadcasting, heartbeats and reconnection myself, which is where the learning is |
| **Security** | **No third-party security service at first.** Spending limits, Nginx request and connection limits, an `Origin` check on the WebSocket upgrade, and validation in the game server | Every match costs LLM money, so unlimited match creation, room creation or tribute spam is a direct cost risk. A hard budget holds even if a bot gets through, and I learn more by building this myself. If bots become a problem, add a CAPTCHA such as Cloudflare Turnstile before match creation, or reconsider a service then |
| **Accounts and payments** | **Clerk** for sign-in and **Clerk Billing** for a monthly membership, with Stripe processing payments behind it. **Deferred until after the MVP (Phase 8), and only built if the measured cost per match and real traffic show it's needed.** The game server verifies Clerk session tokens and checks plans and features itself. The client may hide or show UI by plan, but **only the server's check counts** (§6) | One provider for sign-in, plans and feature checks, and no card handling or subscription state of my own to build |
| **Monetisation** | **The site isn't run for profit. Any money only covers LLM costs if traffic grows.** Watching is always free. The person who starts a match pays for it, through their daily allowance (or, later, a plan). A Supporter membership (about £3–4 a month) is the likely way to cover costs, decided once the cost per match is measured. Money never buys an advantage inside a match. No ads, no loot boxes (§6) | Keeps the game fun for free players, makes inviting friends free later, and ties any paid features to what actually costs money |
| **Usage tracking** | **Every match starts through one service function** that checks the allowance or plan and records usage (player, mode, tribute count, model, tokens, cost), **from Phase 4**, before anything is charged | Limits and prices are set from real data, and membership slots in without retrofitting |
| Identity | **Guest display names for free play,** with no sign-in. The MVP tracks guests by guest ID and IP. Signing in with Clerk (Phase 8) keeps the allowance tied to an account and is required for the Supporter membership. A guest's display name carries over when they sign in | Nobody has to sign up to try the game, but a membership needs an account |
| Authority | **Server-authoritative in both modes.** The simulation and LLM calls run only on the server. Clients send *requests* and render events | Prevents cheating, keeps every player in sync, and keeps API keys secret |
| Agent memory | **Computed, never stored:** `witnessed()` in `sim` rebuilds what each tribute saw from the starting positions and the event log. The prompt gets the last few rounds in detail plus a few long-term facts per tribute it has seen. Relationship tags are the only agent output that is recorded (`docs/agent-prompt.md`) | Gives continuity without token costs growing, keeps one source of truth, and replays need no extra data |
| Order of work | **No graphics until Phase 1 is fun** | The simulation is the product. The visuals present it |

### Suggested stack (confirm in each phase's `/arch` session)

| Area | Proposal |
|---|---|
| Monorepo | **npm workspaces** (`apps/*`, `packages/*`). Turborepo can be added later if task running gets slow |
| Frontend | Next.js, TypeScript, Tailwind, Zustand |
| 3D | `three`, `@react-three/fiber` and `@react-three/drei` (`CameraControls`, `OrthographicCamera`, `Html`, `useFBO`, `Instances`, `Stats`, `PerformanceMonitor`). Optionally `@react-three/postprocessing`, though the hand-rolled console pass is less to learn. The canvas is loaded with `dynamic(..., { ssr: false })` |
| Simulation | `packages/sim`: pure TypeScript with no framework dependencies, unit-tested |
| Arena rules | Pure data, kept in `packages/shared` (`arenas.ts`): zones, adjacency, resources, cover, hazards, starting zones. Move into its own package only if `shared` gets crowded |
| Arena visuals | `apps/web/src/arenas/<arena>/config.ts` plus pure `.ts` geometry maths (zone function, heightfield, colours) with unit tests, and generic scene components in `apps/web/src/components/arena3d/` (see the cheat sheet's folder layout) |
| Server | A Node service for the game loop, LLM calls, usage tracking and (later) rooms, with `ws` attached to its HTTP server |
| Message validation | A schema library such as Zod in `packages/shared`, used by both client and server |
| Database | Postgres for match usage from Phase 4, saved matches from Phase 6 (and rooms in Phase 9). Accounts and subscriptions live in Clerk; Postgres keys rows by Clerk user ID or guest ID |
| Auth and billing (Phase 8, if needed) | `@clerk/nextjs` in the web app and `@clerk/backend` in the game server to verify session tokens and read plans and features. Clerk Billing plans and features, with my own Stripe account connected in production. Not installed before Phase 8 |
| 3D character (Phase 7) | Blender base mesh with shape keys (muscular, lean, heavy, tall) exported as compressed glTF. Weapons attach to the hand bone |
| LLM | A fast, cheap model for decisions, and possibly a stronger one for narration |
| Deploy | Docker on Hetzner via Coolify. Nginx must be configured to allow WebSocket upgrades |

---

## 3. Architecture

```
 Solo player browser ──────┐
 Player A browser ─┐       │            (Phase 9)
 Player B browser ─┼── WebSocket ──┐
 Player C browser ─┘               │
                                   ▼
apps/web  (Next.js)          apps/server (Node)
 3D arenas (R3F)             ├─ Match loop (shared by both modes, no room logic)
   + 2D fallback map,         ├─ Solo: one connection → match loop → finished
 creator + 3D figure,         ├─ startMatch(): allowance/plan check + usage record (Phase 4,
 membership, lobby            │                plan checks from Phase 8)
 arenas/<arena>/config.ts     ├─ Clerk session verification (@clerk/backend)  (Phase 8)
   (visual config, viewer     ├─ RoomManager (rooms in memory)               (Phase 9)
    only)                     ├─ Room: lobby → match loop → finished          (Phase 9)
      │                       ├─ uses packages/sim + packages/agents
      │                       └─ writes events and match usage to Postgres
      │
      │   Clerk (sign-in, Billing plans) ── Stripe processes payments
      │
      ├── packages/sim     ← pure rules engine (deterministic, seeded)
      ├── packages/agents  ← prompt building, schema, LLM client, fallback, relationship tags
      └── packages/shared  ← event types, protocol messages + schemas, tribute validation,
                             arena rules definitions (arenas.ts, for sim)

apps/cli (Phase 1)   ── runs packages/sim + packages/agents in the terminal
```

**Rules of the architecture:**

1. `packages/sim` has **no I/O**: no network, no LLM calls, no `Date.now()`, no `Math.random()`. All randomness comes from the seeded RNG.
2. The engine takes **the arena rules definition, decisions and sponsor gifts as input** and is unaware of the LLM, the network and payments. Agents produce decisions, players produce gifts, and the engine resolves both.
3. LLM output goes through a **schema validator** before it reaches the engine. Anything else becomes the fallback action.
4. The **event log is the contract** between server and client. The client never computes game outcomes.
5. **Every message from a client is untrusted.** It's validated against a schema in `shared`, then checked against the match or room rules (does this player belong to the match, can they afford the gift, is the match running).
6. The narrator reads events and writes text. Nothing it produces goes back into the state.
7. **Three layers of protection.** Nginx guards the doors: request and connection limits. The game server guards everything after that: the `Origin` check on the WebSocket upgrade, message schemas, match and room rules, and per-connection message rate limits. Spending limits sit behind both, so LLM costs stay capped even if the other layers are bypassed.
8. **The match loop knows nothing about rooms, accounts or plans.** It runs a match and emits events to whoever is connected. Solo and multiplayer differ only in how a match is set up and how many connections receive its events. Allowance and plan checks happen in match setup, outside the loop.
9. **`sim` never reads visual config.** Zone shapes, heightfields, props and coordinates are for the viewer only. A test checks that every arena's visual config covers exactly the zones in its rules definition, and that sampling the zone function over the whole arena only ever returns those zone IDs.
10. **Relationship tags never reach the engine.** They live in `agents` and the event stream for display only. The same goes for a tribute's memory: it can be sent to the client to show in tribute detail, but the client never uses it for logic.
11. **Personality prompts stay on the server until the match ends,** except a player's own. The server sends them all with the match-finished message.
12. **The 3D scene and the 2D fallback map are pure view layers.** Both render the same state rebuilt from events. Hazard visuals, lighting and tribute movement all follow events, never their own timers or rules.
13. **Every match starts through one service function** (`startMatch`) that checks the allowance or plan and records usage, before any LLM call. There's no other way to start a match.
14. **Money never buys an in-match advantage.** No plan, feature or purchase touches sponsor points, items, stats, the point budget or anything else `sim` reads. Plan and feature checks happen on the server, against the verified Clerk session, never on a client claim.

---

## 4. Core concepts to design (Phase 1)

I design these myself in `/arch`. They're listed here so the assistant knows what exists, not to dictate fields.

| Concept | What it represents |
|---|---|
| `Stats` | The six attributes, the 36-point budget and the maximum of 10 per stat |
| `Weapon` | Modifiers against stats and situations, plus **ammunition** (bow, throwing knives) |
| `Item` | Sponsor gifts (ration pack, water flask, medkit, arrows, throwing knives) are applied on arrival and never stored. Ammunition adds to the matching weapon's count. Inventories hold only weapons, which is what a killer loots |
| `Tribute` | Identity, cosmetic origin, **owner (a player or AI)**, stats, weapon, personality, health, hunger, inventory, memory, alliances, status |
| `Zone` / `Arena` | The zone graph and its resources, **cover**, hazards and adjacency |
| `Hazard` | Map-wide (lower damage to every tribute) or zone (higher damage to one zone), and when it triggers |
| `Action` | The fixed menu: `forage`, `hunt(target)`, `hide`, `rest`, `move_to(zone)`, `propose_alliance(target)`, `accept_alliance(proposer)`, `betray(ally)` |
| `SponsorGift` | Who sent what to whom, and which round it applies to |
| `GameEvent` | Everything that happened in a round, with a **sequence number**, in a form the narrator, the client and the 3D scene can all use (including the day or night phase and which hazards are active) |
| `GameState` | The full truth at a round boundary |
| Match setup | The seed, arena rules definition and **tribute count**, which is configurable so the engine handles both 8-tribute and 12–24-tribute matches |

Agent-side, not engine: **relationship tags** returned with each decision, based on events the tribute saw.

Later concepts: the arena visual config and coordinate system (Phase 2), the server match loop, `MatchUsage` and the guest allowance (Phase 4), saved matches (Phase 6), the character model's stat-to-shape-key mapping (Phase 7), plans and features (Phase 8), then `Room`, `Player`, and the rest of the protocol messages in §5 (Phase 9).

---

## 5. Solo and multiplayer

Both modes use the same engine, agents, arenas, 3D scene, event log and match loop.

| | Solo | Multiplayer |
|---|---|---|
| **Tributes** | 1 player tribute plus 7 AI tributes | One per human player, with AI filling the empty slots (12 or 24 in total) |
| **Setup** | Play solo → create a tribute → pick an arena → start | Join a room, then follow the room statuses in §5.1 |
| **Connections** | One | One per player |
| **Pacing** | The player can pause and change playback speed | The server sets one pace for everyone, with a countdown to the next round |
| **After elimination** | Keep watching and sponsoring, or leave, which ends the match | Keep watching and sponsoring as a spectator, or leave while the match continues |
| **Paid for by** | The player's daily allowance or plan | The host's allowance or plan covers the whole room. Joining is free |
| **Built in** | Phase 4 (the solo MVP, on Glass Flats) | Phase 9 (add-on) |

In both modes, players watch and sponsor. They never control a tribute directly.

### 5.1 The multiplayer model

A **room** holds one match. Players join a room, build their tributes, and watch the same match together. There's no text chat.

| Room status | What's happening | What players can do |
|---|---|---|
| `lobby` | Waiting for players | Join, leave, pick an arena and tribute count (host) |
| `creating` | Players build tributes | Submit tribute, mark ready |
| `running` | The match is simulating and playing | Watch, send sponsor gifts |
| `finished` | A winner exists | See results, start a new room |

**Roles:**
- **Host:** the player who created the room. Picks the arena and tribute count, and starts the match
- **Player:** owns one tribute and has sponsor points
- **Spectator** (later): watches only

When the match starts, AI-generated tributes fill the empty slots.

### 5.2 How a match stays in sync

```
server:  simulate round N+3 ──> events (seq 412–440) ──send──> every connected client (one in solo)
client:  receives events, queues them, plays them back at viewing speed (round N) in the 3D scene
player:  sends sponsor gift ──> server validates ──> applied at the first unsimulated round ──> ack: "lands round N+4"
```

- The server owns the **only** game state. Clients hold just a playback queue and their own UI state.
- Every event has a **sequence number** per match. Clients remember the last one they received.
- **Reconnecting:** the client sends its last sequence number, and the server replays the events it missed from the log. The same mechanism lets a late joiner catch up.
- **Sponsor timing:** a gift can never change a round that has already been simulated. The server tells the player which round it will land in, and the UI shows that exact round.
- **Running out of buffer:** if playback catches up with the simulation, the client shows the "simulating next round" screen until events arrive.
- **Multiplayer pacing:** all players watch the match at the same pace, which the server controls. Individual players can't pause it.
- **Solo pacing:** the player can pause and change playback speed. While paused, the server stops simulating ahead, so no LLM calls are wasted.
- **Camera is local:** each player's camera choice (Broadcast, Overhead, Ground, Follow) is their own UI state and never goes to the server.

### 5.3 Protocol (categories — I design the exact shapes in `/arch`: the solo messages in Phase 4, the room messages in Phase 9)

| Direction | Solo and shared messages (Phase 4) | Room messages (Phase 9) |
|---|---|---|
| Client → server | start solo match, pause, set playback speed, send sponsor gift, leave match | join room, leave room, submit tribute, ready, start match (host), resume from sequence number |
| Server → client | match started, event batch, sponsor gift accepted or rejected, match finished (with all personality prompts), error (including "daily allowance used") | room state, player joined or left |

All messages are defined as schemas in `packages/shared` and carry a **protocol version**. Membership doesn't go over the WebSocket: Clerk's own components and pages handle sign-in and checkout. The WebSocket only carries the session token the server needs to identify the player (how it's passed is a Phase 8 `/arch` question).

Because `ws` only provides raw connections, these are mine to build on the server. In Phase 4: message parsing and routing, heartbeat (ping/pong) to detect dead connections, and a per-connection limit on how many messages a client can send. In Phase 9: the room registry and broadcasting to a room, and the resume-from-sequence handshake.

### 5.4 Security

| Layer | Protects | How |
|---|---|---|
| Nginx | HTTP routes and the requests that open WebSockets | `limit_req` for request rates and `limit_conn` for connections per IP |
| Game server, at the upgrade | The HTTP upgrade request that opens a WebSocket | Check the `Origin` header before accepting the upgrade, and reject with an HTTP error if it's wrong |
| Game server, on open sockets | Every message on an open socket | Schema validation, match and room rules, per-connection message rate limit, max message size using `maxPayload` in `ws` |
| Game server, outgoing | Hidden information | Other tributes' personality prompts aren't sent until the match ends |
| Accounts and plans | Who a player is and what they've paid for | Clerk session tokens verified on the server with `@clerk/backend`, plan and feature checks with `has()` on the server only, the Clerk secret key on the server only |
| Spending limits | LLM spend | Daily LLM budget, max active matches and rooms, the daily allowance per player (guest ID and IP for guests, Clerk user ID once signed in), a fair-use cap for Supporters, personality prompt length cap, and a spending limit with the LLM provider if it offers one |

Nginx works per *request and connection*, and once a WebSocket is open, messages are no longer HTTP requests. That's why the per-message checks belong to the game server. The spending limits are the real protection for LLM costs, because they hold even if a bot gets through. A membership doesn't replace the daily budget: the budget still caps the worst case.

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
- The device has no WebGL, or can't hold the frame rate (step down quality, then switch to the 2D map)
- A match is counted against the allowance and then fails before its first round (it shouldn't count)
- A Supporter's subscription lapses or a payment fails mid-month (what they keep, and when limits change)
- A player clears their browser to reset a guest allowance
- The Clerk session expires while a match is running (the match carries on; only starting a new one needs a valid session)

### 5.6 Scaling path (build each step only when it's needed)

1. **One Node process** holds all solo matches and rooms in memory, and events are written to Postgres as they happen
2. **Several matches and rooms at once** on the same process, with per-match limits on LLM calls
3. **More than one server process:** sticky sessions per match or room, or Redis pub/sub between processes

### 5.7 How earlier phases prepare for solo and multiplayer

| Phase | What it must already do so later modes slot in |
|---|---|
| 1 | Tributes have an `owner`. Events have a match ID and sequence number and are serialisable. Sponsor gifts are already an engine input, testable from the CLI. **The tribute count is configurable, and random-agent matches work at both 8 and 24 tributes** |
| 2 | The 3D arena reads from an **event source interface**: a log file now, a WebSocket later, with no other changes. Tribute placement doesn't assume 8 tributes (24 is checked in Phase 9). Scene components never name an arena, so Phase 5 is mostly config |
| 3 | Tribute validation lives in `shared`, so the server can re-check every submission |
| 4 | The match loop has no knowledge of rooms and sends events to its connections, so multiplayer can add more connections without changing it. Usage is keyed by match, not by player. `startMatch` records usage against "who starts the match", so a room later records it against its host, and takes the tribute count, so plan checks (Phase 8) and room formats (Phase 9) slot in without touching the match loop |
| 7 | The character model is driven by tribute data alone, so it renders any player's tribute in a lobby or results screen |

---

## 6. Accounts, membership and monetisation

**Deferred until after the MVP (Phase 8).** The site isn't run for profit: a membership would only exist to cover LLM costs if traffic grows. Decide whether it's needed, and what it costs, once the cost per match and real traffic are known.

**What stays in the MVP (Phase 4), because it protects against costs rather than earning money:** usage tracking in `startMatch`, the daily LLM budget, spending limits, and the free daily allowance per guest (tracked by guest ID and IP). The rest of this section describes the plan for Phase 8.

### 6.1 Sign-in with Clerk

- **Guests play without signing in.** Signing in is needed to keep the allowance tied to an account and to become a Supporter. A guest's display name and match history carry over when they sign in
- The web app uses `@clerk/nextjs` (`clerkMiddleware`, Clerk's sign-in and user components). The game server uses `@clerk/backend` to **verify the session token** before `startMatch`, and identifies the player by Clerk user ID
- Postgres stores no passwords or card details. Its rows (usage, saved matches) are keyed by Clerk user ID, or by guest ID for guests
- How the token reaches the WebSocket server (a cookie on the same domain, or the token in the first message) is a Phase 8 `/arch` decision. The `Origin` check and message schemas still apply either way

### 6.2 Membership with Clerk Billing

- Clerk Billing handles **subscription plans** (monthly, optionally annual), with Stripe processing the payments. Plans and features are set up in the Clerk Dashboard
- The server checks access with `has({ plan })` or `has({ feature })`. The client can hide or show UI by plan, but **only the server's check counts**
- **Prefer features over plan names in checks** (for example `extra_matches`, `large_formats`), so plans can be renamed or repriced without code changes
- Development uses Clerk's shared test payment gateway. Production needs my own Stripe account connected to Clerk
- **Check before going live** (from Clerk's docs and a September 2026 review, so re-check): Clerk charges 0.7% per transaction on top of Stripe's fees. The review reported that Clerk Billing was **USD only**, had **no tax or VAT handling** (Clerk isn't a merchant of record), and had **no 3D Secure support**, so card payments that need a challenge fail. 3D Secure matters for UK cards. If any of these still holds and is a blocker, the fallback is Stripe Billing directly behind Clerk sign-in, keeping the same `startMatch` checks
- **One-off purchases** (cosmetics) aren't covered by Clerk's subscription docs. Check the current docs when cosmetics arrive, and otherwise use Stripe directly for them

### 6.3 Monetisation plan

**Principle:** watching is free, the person who starts a match pays for it (through their allowance or plan), and money buys more matches, bigger formats and cosmetics, **never an advantage inside a match** (§3 rule 14).

**Free tier**
- **Watching is always free,** with no limit. In multiplayer (Phase 9), **joining someone else's room is also free:** spectators and joiners cost almost nothing, and each one is a potential future host
- Each player gets a small **daily allowance of matches they start** (starting idea: 3 a day). A solo match uses one. A match that fails before round 1 doesn't count
- In multiplayer, **the host's allowance covers the whole room,** so inviting friends costs them nothing. That's the main growth loop
- Guests' allowance is tracked by guest ID and IP. Signing in ties it to the account, so clearing the browser doesn't reset it
- Cost reference: write down the measured cost per match from Phase 1 here. Earlier estimates on a cheap model (for example Claude Haiku 5.5 or GPT-5 nano, October 2026 prices) were well under 1p per small match. A free player who uses their whole allowance costs a few pence a day, and most won't use it all. Re-check prices before setting the allowance

**Supporter membership (main revenue)** — about £3–4 a month through Clerk Billing:
- More matches a day, or unlimited within a fair-use cap
- Saved tribute rosters, and longer match history and replays
- Possibly a stronger narrator model for their matches (cosmetic only, so it doesn't break rule 14)
- From Phase 9: **bigger formats** (12- and 24-tribute rooms), which cost more in LLM calls and so are a natural paid feature, plus private or password-protected rooms

**Prefer a subscription to small one-off packs.** Card fees include a fixed charge per transaction, which takes a large share of a £1 purchase. If packs are ever added, the smallest is around £3–5.

**Cosmetics (after the solo MVP, building on the Phase 7 character model)**
Tribute skins, weapon looks, arena themes and **announcer personas** (for example a gritty war reporter or an over-the-top game-show host). They're visible to everyone in a shared match and change nothing about who wins. Announcer personas are a cheap fit, because narration is already a prompt.

**Never**

| Never sold or offered | Why |
|---|---|
| Sponsor points, items, stats or a bigger point budget | Sponsoring is the core social mechanic. Pay-to-win drives away the free players who fill every match |
| Ads | They'd clash with the broadcast look and the experience |
| Loot boxes or paid random rewards | Increasingly regulated in the UK and EU, and they sour goodwill |

**Order of operations:** usage tracking from Phase 4 → launch the solo game with the free allowance only → watch how many matches a typical player starts and what they cost → if costs need covering, add the Supporter membership in Phase 8 with limits based on those numbers. That way nothing is ever taken away from players, only added.

**Later options:** bring your own API key for heavy users, and seasons or tournaments with cosmetic rewards once there's a community.

---

## 7. Scope

**In the MVP (Phases 1–4, target 2026-12-31):** the engine with all four arenas as rules data, alliances, the LLM agents and narrator, Glass Flats in 3D with the console look, the character creator with a placeholder figure, live solo play with sponsoring, usage tracking, spending limits and a free guest allowance, deployed, with responsive layouts for desktop and mobile web.

**In after the MVP (Phases 5–9):** the other three arenas in 3D and the 2D fallback map, saved matches and replays, the morphing 3D character model, accounts and membership (only if needed, §6), and multiplayer as described in §5.

**Out (for now):**
- Real-time action within a round (it stays round-based)
- Players controlling their tribute directly
- Text chat between players, including the lobby
- Public live matches, scheduled broadcasts and watching other people's matches from the landing page
- Account features beyond what Clerk provides (no profiles or friends lists)
- The snare kit, thrown spears and supply caches
- Visibility hazards (zone cover handles visibility)
- A 2D map with features of its own (the fallback only shows what the 3D view shows)
- Ranked matchmaking, public room browsing
- Cosmetics and one-off purchases in the MVP (they come after it, §6.3)
- Ads, loot boxes and anything money buys that changes a match
- Full 3D animated combat. Tributes are low-poly figures that move between zones; there are no fight animations
- Mobile apps

---

## 8. Open questions (good material for `/arch` and `/explore`)

- ~~**Replay determinism**~~ *(decided in Phase 1 step 8: store the seed, the recorded decisions and gifts, and the event log. Memory is recomputed; relationship tags are recorded. See `docs/agent-prompt.md`)*
- **Cost per match:** tributes × rounds × calls, at 8 tributes (and estimated for 24). What is the per-match budget, and which model gives acceptable quality at that cost?
- ~~**LLM failure handling**~~ *(decided in Phase 1 step 8: refusals, cut-off replies, API errors, timeouts and illegal actions all go straight to a cautious fallback action, with the reason recorded. Retries are added only if the playtest fallback rate is high. See `docs/agent-prompt.md`)*
- **Match pacing:** how many rounds, how arena events compress the late game, and how long a match lasts in real time
- **Solo match length:** an 8-tribute match should last roughly 10 minutes, 30-40 rounds, at 15-20 seconds per round.
- **Zone closures:** how many tributes alive per open zone should trigger a closure, and whether that value works at both 8 and 12–24 tributes
- **Glass Flats at 24 tributes:** whether 5 zones is too crowded, or whether that suits a fast, open arena
- **Hazard values:** damage for map-wide and zone hazards, how often they trigger, and whether some only trigger by day or night
- **Weapons:** ammunition amounts, and whether each weapon's power and stat suit its role
- **Alliances and betrayal:** how they're represented, and whether both sides have to agree
- **Relationship tags:** the exact caps (tags per tribute, tag length, enforced in our own validation because the schema can't), whether to restrict them to an allowed set, and how they fade
- **Personality prompt content:** content filtering, and how much the prompt influences behaviour versus the stats
- **Sponsor economy:** points earned per day survived, item costs, and limits that stop one player dominating
- **Buffer size:** how many rounds ahead, and how this feels when a sponsor gift lands later than expected
- **Camera switch:** how to animate between the perspective Broadcast camera and the orthographic Overhead camera (for example, fly the perspective camera to straight down, then swap to an orthographic camera with a matching zoom), and whether labels and markers stay readable in both
- **Day and night per arena:** how far the lighting shifts between phases, especially for arenas with a strong signature mood
- **Crowding in 3D:** how 24 tributes stay readable in a small zone from both cameras (spacing within a zone, label stacking, Follow my tribute)
- **3D on mobile:** whether every arena holds 30 fps on a mid-range phone within the cheat sheet's budget (under 30k triangles, under 60 draw calls, under 800 particles, no shadows), and what steps down first
- **When to switch to the 2D map:** the trigger after quality has stepped down (frame rate over how long), whether the player can switch back, and whether to offer a manual "2D map" toggle as well
- **Character model in the arena:** whether the morphing model appears in the arena (as a low-poly version) or only in the creator, tribute detail and results
- **Allowance and pricing:** the daily allowance (starting idea 3), the Supporter price (about £3–4 a month), what the fair-use cap is, and whether there's an annual plan, all set against the measured cost per match
- **Clerk Billing's limits:** whether it still lacks GBP, VAT handling and 3D Secure (§6.2), and if so, whether to switch to Stripe Billing directly behind Clerk sign-in
- **Selling subscriptions in the UK:** VAT, consumer cancellation rights for digital services, and the terms, privacy and refund pages needed before going live. Check the current rules rather than assuming
- **Lapsed memberships:** what a Supporter keeps when a payment fails or they cancel (saved rosters, history), and when limits drop back
- **Session on the WebSocket:** how the Clerk session token reaches the game server, and what happens when it expires mid-match
- **Room size:** maximum human players per room, and how AI tributes fill the rest
- **Joining:** invite links or room codes, and whether late joiners can enter a running match as spectators
- **Room formats by plan:** which room sizes free hosts get, and which need the Supporter membership
- **Limit values:** the daily LLM budget, max active matches, how many solo matches and rooms per player per hour, and Nginx limits that won't block friends sharing a network
- **Identifying players for rate limits and the allowance:** IP address at first, a guest ID once players have one, and the Clerk user ID once they sign in

---

## 9. How the project progresses

### 9.1 The loop every phase follows

| Step | Toolkit | What happens |
|---|---|---|
| 1. Warm-up | `/retrieve` | At the start of a session, a short quiz on earlier phases, using `learning/` |
| 2. Design | `/arch` | I design the phase before writing code. One question at a time, and you challenge my assumptions |
| 3. New libraries | `/api` | Whenever I pick up a new library or API, before using it |
| 4. Contract first | `/test` | For engine, protocol, geometry and allowance logic: I define the contract and edge cases, then write failing tests |
| 5. Build | `/hint`, `/debug` | I implement. Hints come one level at a time, and I form a hypothesis before any debugging help |
| 6. Review | `/code-review` | I name my weakest part first, then you review, correctness before style |
| 7. Post-mortem | `/autopsy` | After any non-trivial bug. You prompt me to do this |
| 8. Stress-test | `/explore` | At the end of the phase, introduce constraints one at a time (scale, failure, cost) |
| 9. Teach back | `/explain` | I explain the phase's key concept as if to a beginner |
| 10. Log | — | Update `learning/concepts.md` and `learning/mistakes.md`, then check the phase's "done when" |

**Don't start the next phase until the current phase's "done when" is met.** If I try to skip ahead, point it out.

### 9.2 Roadmap at a glance

| Phase | What | Milestone |
|---|---|---|
| 0 | Scaffolding | |
| 1 | Text-only simulator (CLI) | The engine is fun to read |
| 2 | Glass Flats in 3D, with playback | A stored log plays back in the 3D Glass Flats arena |
| 3 | Character creator | Valid tributes, checked on both sides |
| 4 | Solo play on Glass Flats | **Solo MVP:** a live, deployed solo game with sponsoring, usage tracking, spending limits and a free allowance |
| 5 | The other three arenas in 3D, and the 2D fallback map | All four arenas playable live |
| 6 | Saved matches and replays | Any finished match replays in 3D |
| 7 | 3D character model | The tribute's figure morphs with its stats |
| 8 | Accounts and membership (Clerk) | Only once the cost per match and real traffic show it's needed (§6) |
| 9 | Multiplayer (add-on) | Rooms on the same match loop |

**Target:** the solo MVP (the end of Phase 4) by **2026-12-31**. Phases 5–9 come after it. Their order is a starting point, to be reviewed once the MVP is live.

**The vertical slice.** Phases 2–4 build the whole game end to end on **one arena, Glass Flats**, before the other three arenas get their 3D scenes in Phase 5. That way problems with the event format, playback or the live stream show up while they're still cheap to fix, and there's something playable early. The rules data for all four arenas is still finished in Phase 1, because it's cheap and lets CLI and random-agent matches test every arena.

**Tribute counts.** Solo is 8 tributes. The engine still takes a configurable count, and random-agent tests still run at 24, because both are cheap. Anything that only matters for 12–24 tributes in the browser (3D crowding, 24-tribute logs on every arena) waits for Phase 9.

---

### Phase 0 — Scaffolding *(shipping mode)*

**Goal:** an npm workspaces monorepo with `apps/cli`, `packages/sim`, `packages/agents` and `packages/shared`, using TypeScript strict mode, a test runner, linting and formatting.

**Done when:** `npm test -w packages/sim` runs an empty suite, and `npm start -w apps/cli` prints "hello arena".

---

### Phase 1 — Text-only simulator (CLI)

**Goal:** a full match runs in the terminal on any of the four arenas, and *reading the log is entertaining*. LLM matches are played at 8 tributes. Random-agent matches also run at 24.

**Order:**
1. `/arch`: the data model (§4), including tribute owners, a configurable tribute count, weapons and ammunition, hazards, sequence-numbered events and sponsor gifts (§5.7)
2. `/arch`: the shape of one round: perception → decision → validation → resolution → events
3. `/test` → build: **seeded RNG** and state setup
4. `/test` → build: **movement, hunger, resources and cover** on Sector Nine (no combat yet). Run a match where everyone just survives
5. `/test` → build: **combat resolution** (stats, weapon modifiers, ammunition, looting and seeded dice). Test this heavily
6. Build: **random-agent mode**, which picks valid actions at random so the engine can be tested without any LLM
7. `/test` → build: **sponsor gifts as engine input**. A CLI flag can inject a gift at a given round
8. `/api` on the LLM SDK and structured output → `/arch`: the **agent prompt and response schema**, including relationship tags (`docs/agent-prompt.md`)
9. `/test` → build: the **LLM decision loop** with validation and fallback, computed memory (`witnessed()`) and relationship tags
10. `/arch` → `/test` → build: **alliances**: proposing, accepting (both sides must agree), allies can't hunt each other, an ally's sightings appear in your perception, and betrayal. Add them to the random agent and the prompt
11. Build: **arena events**: zones closing based on tributes alive per open zone, and **map-wide and zone hazards** from the arena definition, emitting `HazardStruck`. Make sure events carry what the 3D scene will need later (day or night phase, active hazards, closures)
12. Add the other three arenas as rules data in `packages/shared` (`arenas.ts`), each with hand-picked `startingZoneIds`
13. `/api` → build: the **narrator**
14. Playtest about 10 LLM matches at 8 tributes across all four arenas, then tune the numbers. Random-agent matches at 8 and 24 can test how often tributes meet and how deadly each arena's hazards are, without any LLM cost

**Learning focus:** deterministic simulation, seeded randomness, data-driven rules, structured LLM output, defensive validation, prompt design.

**Done when:**
- [ ] The same seed with recorded decisions and gifts produces an identical event log
- [ ] Random-agent matches on all four arenas at both 8 and 24 tributes always end with exactly one survivor, with no crashes or stuck states
- [ ] Malformed or hostile LLM output (including injection in personality prompts) never breaks the engine
- [ ] A gift injected from the CLI changes the outcome of later rounds, and never earlier ones
- [ ] Ammunition runs out, and a killer takes the victim's weapon with its remaining ammunition
- [ ] An alliance only forms when both sides agree, allies can't attack each other, and a betrayal shows up in the betrayed tribute's memory
- [ ] Personality noticeably changes behaviour across matches
- [ ] I'd happily read a full narrated 8-tribute match
- [ ] I know the cost per match at 8 tributes, have estimated it for 24, and have written both down

**Carry forward:** the event-log format becomes the client contract in Phase 2, the live stream in Phase 4 and the multiplayer stream in Phase 9. Freeze it here.

---

### Phase 2 — Glass Flats in 3D, with playback

**Goal:** a web UI that plays back a **stored** Glass Flats event log in a fully 3D arena: tributes move between zones, hazards and closures show on the terrain, day and night follow the events, and the announcer feed scrolls, with the Broadcast (perspective) and Overhead (orthographic) cameras on the same scene and the console look applied. The Glass Flats prototype (`docs/Glass Flats 3D.html`) and the *3D Arena Cheat Sheet* (`docs/`) are the references.

Split into two parts. The first plays a log before the second starts.

#### 2a — The scene and playback

**Order:** `/api` on React Three Fiber and drei (`Canvas`, `useFrame`, `useThree`, `CameraControls`, `OrthographicCamera`, `Html`) → `/arch` the playback architecture (event source interface, event queue, playback clock, interpolation, seeking) and the arena scene (the visual config shape, the coordinate system, cameras, how a tribute's cosmetic spot is chosen inside its zone) → `/test` `coords.ts`, Glass Flats' zone function and heightfield (zone at known points, height at the crater centre), and the test that the visual config covers exactly the rules zones → the Next.js canvas page (`ssr: false`, fixed-height parent, `<Stats />`) → terrain with face colours and flat shading → lights, fog and sky, tuned until they match the prototype (expect to raise light intensities with current three) → Mirror Basin glass, crater pool and glass rays → props from the config → zone boundaries and HTML zone labels → tribute figures with HTML chips, repeatable spots inside their zone, lerped between rounds, clickable through to tribute detail → announcer feed synced to events → play, pause, speed and seeking to a sequence number → cameras: Broadcast and Overhead with an animated switch, then Ground and Follow my tribute.

**Done when:**
- [ ] A Phase 1 Glass Flats log plays back correctly from start to finish
- [ ] Switching between Broadcast and Overhead animates the same scene, without restarting playback
- [ ] Seeking to any point shows the correct state
- [ ] Every tribute always stands inside the zone the events say it's in, at a spot that doesn't jump between renders
- [ ] The client contains **no** game logic. It only applies events
- [ ] Events come in through an event source interface that a WebSocket could implement later

#### 2b — Console look, hazards and performance

**Order:** day and night lighting driven by the round phase in events → closures and hazards on the terrain, driven by the active hazards in the replayed state, with fades → Glass Flats' hazard visuals (sinkhole sand streams, midday heat shimmer) → the console-look pass (low-res render target, 15-bit dither, heat haze) with `useFBO`, then vertex wobble with `onBeforeCompile` → `prefers-reduced-motion` → the phone pass: render scale, terrain segments, shadows off with blob decals, `PerformanceMonitor` stepping down automatically → the arena loading screen while geometry builds and shaders compile → a plain "this game needs WebGL" message for devices without it (the 2D fallback map comes in Phase 5).

**Done when:**
- [ ] Every hazard and closure reads at a glance from both the Broadcast and Overhead cameras
- [ ] Seeking past a hazard or closure shows the right visuals for that point, with no leftover effects
- [ ] It holds 30 fps or better on a mid-range phone, within the cheat sheet's phone budget
- [ ] Reduced motion turns off auto-orbit, heat haze and weather motion
- [ ] Scene components never mention Glass Flats by name: everything arena-specific lives in its config, ready for Phase 5

**Learning focus:** turning an event stream into animation, separating playback time from simulation time, rebuilding state by replaying events, client state with Zustand, scenes in React Three Fiber, perspective and orthographic cameras, heightfields and flat-shaded geometry, a custom post-processing pass and shader patches, particles driven by state, 3D performance budgets on phones, designing an interface so the data source can change later.

**Shipping zone:** Next.js setup, layout and styling, and arena visual config data entry (prop placements, palettes, label positions) once I've designed its shape.

---

### Phase 3 — Character creator

**Goal:** a name, a cosmetic origin, a radar chart with a 36-point budget, a weapon picker with the five weapons, and a personality prompt of up to 280 characters. It outputs a valid `Tribute` config that the engine accepts. The preview uses the same low-poly placeholder figure as the arena (the morphing model is Phase 7).

**Order:** `/arch` validation (the client checks for UX, the server checks for real) → `/test` the point-budget and prompt rules in `shared` → an interactive radar chart → weapon picker → personality input with length cap → the preview canvas with the placeholder figure → run a CLI match with created tributes.

**Learning focus:** validating input on both client and server with shared rules, and building an interactive custom SVG or canvas control.

**Shipping zone:** the creator's layout and styling, and the radar chart's visuals once I've designed how it behaves.

**Done when:**
- [ ] It's impossible to submit an over-budget or invalid tribute, even by editing the request by hand
- [ ] A created tribute plays in a match and behaves according to its personality

---

### Phase 4 — Solo play on Glass Flats *(completes the solo MVP)*

**Goal:** the game in the browser: one player chooses Play solo, creates a tribute, watches a live 3D match on Glass Flats against 7 AI tributes, sponsors during it and sees the results. It's deployed and protected against runaway LLM costs.

Split into three parts. Each one is playable before the next starts.

#### 4a — A live solo match

**Order:** `/api` on `ws` (what it gives you, and what it deliberately doesn't) → `/arch` the match loop, its separation from rooms (§3, §5.7) and the solo protocol (§5.3) → `/test` message schemas and solo match rules in `shared` → the `ws` server attached to the Node HTTP server, with message routing and heartbeat → landing page with guest name and Play solo → solo setup: create tribute, start (the arena picker offers Glass Flats until Phase 5) → `startMatch`, the one service function every match starts through, recording usage in Postgres (player or guest ID, mode, tribute count, model, tokens, cost) → the server match loop wrapping `sim` and `agents`, filling the 7 AI slots → stream event batches into the 3D arena through the event source interface → pause and playback speed, with simulation stopping while paused → the "simulating next round" screen when the buffer runs out → keep watching or leave after elimination → results screen, revealing every personality prompt.

**Done when:**
- [ ] One player can go from the landing page to a full live 3D match against 7 AI tributes in the browser, and see the results
- [ ] While the match is paused, no new rounds are simulated and no LLM calls are made
- [ ] Other tributes' personality prompts never reach the client before the match ends
- [ ] Forged or malformed messages are rejected without affecting the match
- [ ] The match loop contains no room logic
- [ ] Every match, including failed ones, has a usage record with its real token count and cost

#### 4b — Sponsoring and the round buffer

**Order:** `/arch` the buffer, sponsor timing and points earned per day survived (§5.2) → `/test` gift validation and round assignment → send-gift UI with sponsor points → server acknowledgement showing the exact round the gift lands in → the gift's landing shown in the 3D scene.

**Done when:**
- [ ] A gift lands in the round the UI promised, and the player sees it happen
- [ ] A gift sent while the match is paused still lands in the correct round
- [ ] Sponsor points increase for each day the player's tribute survives

#### 4c — Protection and deploy

**Order:** `/arch` where each protection sits (§5.4) → spending limits, including the daily LLM budget and the daily allowance per guest in `startMatch` → `Origin` check on the WebSocket upgrade → per-connection message rate limit and max message size in the game server → solo disconnect handling → server restart mid-match: end the match cleanly, without using the player's allowance (resuming comes with saved matches in Phase 6) → `/explore` the solo failure cases in §5.5 → deploy with Coolify, including Nginx WebSocket upgrades, `limit_req` and `limit_conn`.

**Done when:**
- [ ] Someone on a different network can play a full solo match with sponsoring
- [ ] An LLM outage mid-match degrades to fallback actions instead of crashing the match
- [ ] A disconnected solo player's match stops spending LLM money
- [ ] Restarting the server mid-match never leaves a match stuck or half-finished
- [ ] Creating solo matches in a loop from a script gets blocked by the limits before any LLM call is made
- [ ] No new match can start once the daily LLM budget is reached
- [ ] A guest who has used their daily allowance can still watch, but can't start another match
- [ ] A WebSocket upgrade from the wrong `Origin` is rejected
- [ ] A client flooding messages on an open socket gets limited or disconnected

**Learning focus:** server-authoritative real-time systems, WebSockets with `ws`, protocol design, separating playback from simulation on the server, hiding information from clients, layered security.

**Shipping zone:** Dockerfile, Coolify and Nginx config, and the landing, setup and results page layouts.

**Solo MVP check (all must hold before Phase 5):**
- [ ] Every Phase 1–4 "done when" is met
- [ ] Someone on a different network can play as a guest: build a tribute, play and sponsor a full live match on 3D Glass Flats, and see the results
- [ ] The cost per match is written down, and the daily LLM budget and guest allowance are set from it

---

## After the MVP

Phases 5–9 are planned in less detail. Each one starts with its own `/arch`, and the order can change once the MVP is live.

### Phase 5 — The other three arenas in 3D, and the 2D fallback map

**Goal:** Sector Nine, The Verdance and Whiteout get their 3D scenes, so all four arenas can be played live, and devices without WebGL get the 2D map.

**Order:** Sector Nine (city blocks and sunken streets, towers with window textures, neon, rain, drones) → The Verdance (river channel and water plane, trees, light shafts, fireflies, flash flood) → Whiteout (tilted ice plates, crevasses, ice spires, sideways snow, thin-ice cracks) → each arena's hazard and closure visuals, day and night lighting, and the console-look settings from the cheat sheet's per-arena kits → the zone-coverage test for all four → the arena picker offers all four → the **2D fallback map** in SVG, drawn from the same visual config (zone boundaries, labels) and the same replayed state and tribute spots, shown when WebGL is missing or the device stays too slow at the lowest quality.

**Done when:**
- [ ] Any arena plays live and from a log file at 8 tributes, in 3D and on the 2D fallback map
- [ ] Scene components never mention an arena by name. Each arena is a config plus a few arena-only parts
- [ ] Each arena reads as a different place, even as a thumbnail
- [ ] Every arena runs smoothly on a mid-range phone
- [ ] The 2D map contains no logic of its own: it reads the visual config and the replayed state, nothing else, and every tribute is in the same zone and spot as in 3D

**Learning focus:** graceful degradation to a 2D view from the same data, making a scene data-driven enough that a new arena is mostly config.

**Shipping zone:** arena visual config data entry for the three arenas.

---

### Phase 6 — Saved matches and replays

**Order:** `/arch` what gets stored for a replay (recorded decisions and gifts plus the event log, see `docs/agent-prompt.md`) and the Postgres schema for matches and events → events saved to Postgres as they happen → Watch replay from the results screen, through the same event source interface → key moments that jump to the right sequence number → server restart mid-match: resume from the event log.

**Done when:**
- [ ] A saved solo match replays in the 3D arena, and key moments jump to the right point
- [ ] Restarting the server mid-match resumes the match from the event log

**Learning focus:** event-sourced persistence and replays.

---

### Phase 7 — 3D character model

**Goal:** a morphing 3D figure of the tribute, replacing the placeholder in the creator, and shown in tribute detail and results, in the same console look as the arenas.

**Order:** `/api` on loading glTF in React Three Fiber (`useGLTF`, morph target influences, skeletons and bones) → `/arch` how the six stats map to shape keys, and where the model appears (creator, tribute detail, results, and whether a low-poly version replaces the arena figures) → the Blender base mesh with shape keys (muscular, lean, heavy, tall), exported as compressed glTF → load it in the creator and drive the shape keys from stats, tweened smoothly → attach the five weapons to the hand bone → apply the console look (low-res pass, wobble) so it matches the arenas → show it in tribute detail and on the results screen → optionally, a low-poly version in the arena's Broadcast camera, still driven by the same events → phone pass (triangle budget, file size, loading inside the arena loading screen).

**Learning focus:** glTF, morph targets and shape keys, skeletons and bone attachment, asset compression, keeping 3D a pure view layer.

**Shipping zone:** Blender export settings and asset-pipeline glue.

**Done when:**
- [ ] Changing stats morphs the model smoothly
- [ ] All five weapons attach to the hand correctly at every body shape
- [ ] The arena still plays the same event logs and live solo streams, without any changes to `sim`
- [ ] It still runs smoothly on a mid-range phone, and the model loads without a noticeable wait

---

### Phase 8 — Accounts and membership *(only if needed)*

**When:** only once the cost per match and real traffic are known (§6). The site isn't run for profit. A membership exists only to cover LLM costs if traffic grows, so if the free allowance and daily budget keep costs manageable, this phase can shrink or wait.

**Goal:** players can sign in with Clerk and subscribe to the Supporter membership through Clerk Billing, and the game server enforces the allowance and plan features, while guests keep playing free.

**Order:** `/arch` identity, the allowance, the Supporter features and how the game server learns who a player is (§6) → `/api` on Clerk (`clerkMiddleware`, sign-in components, `@clerk/backend` token verification, `has()`) and Clerk Billing (plans, features, the pricing table and checkout components, test gateway) → re-check Clerk Billing's limits (§6.2) and decide whether it can launch as is → `/test` the allowance and plan rules in `startMatch` (guest allowance, signed-in allowance, Supporter fair-use cap, failed matches don't count, a forged plan claim from the client is ignored) → sign-in in the web app, carrying the guest's display name and history over → session verification in the game server before `startMatch` → plans and features in the Clerk Dashboard, checked with `has({ feature })` on the server → membership UI: pricing table, allowance left today, manage subscription → Supporter features for solo (more matches, saved tribute rosters, longer history and replays) → terms, privacy and refund pages → `/explore` the account and membership failure cases in §5.5 → connect my own Stripe account and switch to production in Clerk.

**Done when:**
- [ ] A test-mode subscription works end to end, and the Supporter features unlock only after Clerk reports the plan
- [ ] Editing any client request, local state or UI flag can't unlock a Supporter feature or extra matches
- [ ] A match can't start without allowance or a plan, and the check happens on the server before any LLM call
- [ ] Cancelling or a failed payment drops the player back to the free allowance as designed
- [ ] Guests can still play their free allowance without signing in
- [ ] Nothing a plan unlocks changes anything `sim` reads
- [ ] A real subscription works on the deployed site, including a UK card that needs 3D Secure (or the fallback in §6.2 is in place)
- [ ] The Supporter price covers a typical Supporter's measured usage

**Learning focus:** delegating authentication without trusting the client, verifying sessions on a separate server, feature-based access checks, designing a free tier and a subscription from usage data.

**Shipping zone:** Clerk and Clerk Billing setup, membership UI styling, legal page layout (the content is mine to decide).

---

### Phase 9 — Multiplayer *(add-on)*

**Goal:** several players share one match in a room, with AI tributes filling the empty slots. It runs on the same match loop and 3D arenas as solo (and the same accounts, if Phase 8 exists).

Split into three parts. Each one is playable before the next starts.

#### 9a — Rooms and a shared live match

**Order:** `/arch` rooms, room statuses, roles, the room protocol (§5.1, §5.3) and room formats (§6.3) → `/test` message schemas and room rules in `shared` → the `RoomManager` and broadcasting to a room → Create lobby and Join with a code on the landing page → lobby UI: room code, player slots with each tribute's figure, host controls, submit tribute, ready → the host's allowance (or plan) covers the room in `startMatch` → connect rooms to the existing match loop, with AI filling the empty slots → the countdown to the next round → **12- and 24-tribute matches in the browser:** readable crowding in 3D (spacing within a zone, label stacking, Follow my tribute) and a 24-tribute log on every arena.

**Done when:**
- [ ] 2 or more browsers join one room, submit tributes and watch the same match in sync, in 3D
- [ ] A room match uses only the host's allowance or plan, checked before any LLM call, and joining is free
- [ ] Forged or malformed messages are rejected without affecting the room
- [ ] A 24-tribute match stays readable from both cameras on every arena
- [ ] Solo still works, on the same match loop

#### 9b — Shared sponsoring

**Order:** `/arch` sponsoring with several players (§5.2) → `/test` simultaneous gifts and round assignment → show every player's gifts to the whole room.

**Done when:**
- [ ] A gift from any player lands in the promised round, and every player sees it happen
- [ ] Two gifts sent at the same moment are both handled correctly

#### 9c — Resilience and persistence

**Order:** reconnection from the last sequence number → host leaving → extend saved matches and replays to rooms → extend the Nginx limits, spending limits and allowance checks to room routes (§5.4) → `/explore` the failure cases in §5.5 → update the deployment.

**Done when:**
- [ ] 3 or more people on different networks play a full match with sponsoring
- [ ] Refreshing the page mid-match catches the client up without losing anything
- [ ] Saved room matches replay in the 3D arena, and key moments jump to the right point
- [ ] An LLM outage mid-match degrades to fallback actions instead of crashing the room
- [ ] Creating rooms in a loop from a script gets blocked by the limits before any LLM call is made
- [ ] A client flooding messages on an open socket gets limited or disconnected, and the room carries on

**Learning focus:** broadcasting and room management, keeping several clients in sync, reconnection and failure modes, concurrency around round boundaries.

**Shipping zone:** lobby layout and deployment config changes.

---

## 10. About me (learner profile)

- **Role:** Junior frontend developer, with about 1.5 years in React/JavaScript and about 1 year in WordPress/PHP
- **Strong in:** React, Next.js, TypeScript, Tailwind. Some Three.js
- **Infrastructure:** I self-host on a Hetzner VPS with Coolify, Docker and Nginx
- **New to:** game simulation design, LLM agent loops, real-time multiplayer and WebSockets, application security, React Three Fiber scenes and shaders, 3D character morphing, authentication and subscriptions
- **Pitch level:** someone who knows the web stack well but hasn't built games. Relate new ideas to web concepts where possible. For example: the event log is like a Redux action log, the round buffer is like prefetching, server authority is like never trusting the client in a form submit, a WebSocket is like an HTTP request that stays open so the server can push to you, the 3D scene is like a React component that renders from a store, and `startMatch` is like a single checkout endpoint that every purchase must go through.

---

## 11. How to guide me

### Learning zones (toolkit rules — I try first, I predict, hints one level at a time)

- The simulation engine, combat rules, weapons, hazards, seeded RNG and game-state types
- The agent decision loop: prompt, schema, validation, fallback, memory, relationship tags
- The event-log format, playback and seeking
- The 3D arena scene: the visual config and coordinates, heightfields, cameras and the perspective-to-orthographic switch, the console-look pass and shader patches, hazard visuals driven by events, performance on phones
- Solo play: the server match loop, the WebSocket protocol on `ws`, heartbeats, message validation, buffering, pausing, sponsor timing, hidden prompts, saved matches and replays
- Shape-key morphing, bone attachment and how the 3D views consume events
- Accounts and membership: verifying Clerk sessions on the game server, the allowance and plan rules in `startMatch`, usage tracking
- Multiplayer: rooms, broadcasting, sync and reconnection
- Security design: what Nginx protects, what the game server must protect itself, how spending limits cap LLM costs, how plan checks are protected, and why
- Any bug I hit: `/debug`, then `/autopsy` if it was non-trivial

### Shipping zones (give me a working answer when I say "ship this")

- Project scaffolding, config files, linting and formatting
- Docker, Coolify and Nginx deploy config (including WebSocket upgrade headers)
- Nginx `limit_req` and `limit_conn` config, once I've designed the limits
- Boilerplate UI components and styling, including lobby layout, membership pages and responsive layouts
- Arena visual config data entry (prop placements, palettes, labels), once I've designed its shape
- Asset-pipeline glue and Blender export settings
- Clerk, Clerk Billing and Stripe dashboard setup steps

### Style

- **One question at a time.** Don't front-load long explanations.
- Begin every phase with `/arch` and every new library with `/api`.
- Keep me to the roadmap. If I start on graphics before Phase 1's "done when" is met, on solo play before Phase 3's, on the other arenas, replays, the character model, membership or multiplayer before the solo MVP check at the end of Phase 4, say so.
- Flag these immediately, even in shipping mode: game logic leaking into the client, the 3D scene or the narrator; room, account or plan logic leaking into the match loop; `sim` reading visual config or coordinates; match data carrying x/y positions; hazard visuals or lighting running on their own timers instead of events; the 2D fallback map gaining logic or data of its own; relationship tags reaching the engine; non-determinism inside `sim`; unvalidated LLM output reaching the engine; client messages trusted without validation; other tributes' personality prompts sent to a client before the match ends; API keys or the Clerk secret key reaching the client; plan or feature checks done only on the client; a match started anywhere other than `startMatch`; anything money buys that changes a match; match or room creation without spending limits or an allowance check; the WebSocket upgrade left without an `Origin` check.
- Point me to official docs when relevant (three.js, React Three Fiber, drei, `ws`, Clerk).

---

## 12. Conventions

- **Language:** TypeScript strict mode everywhere
- **Package manager:** npm workspaces. Internal packages are referenced with `"*"` (for example `"@arena/sim": "*"`), and scripts are run per package with `-w` (for example `npm test -w packages/sim`). Every package declares the dependencies it imports, even if they'd resolve from the root anyway
- **Packages:** `@arena/sim`, `@arena/agents`, `@arena/shared`
- **Naming:** "map" in this brief means "arena" in code (`ArenaDefinition` for rules, `ArenaConfig` for visuals, `arenaId`, `arenaDefinitions`). The cameras are `broadcast`, `overhead`, `ground` and `follow`
- **Coordinates (viewer only):** map units 0–800 with (400, 400) at the centre and y pointing south; world units −80 to 80, converted at the edge in `coords.ts`. These never appear in `sim`, `shared` or events
- **3D code:** geometry maths lives in plain `.ts` files with no React, built in `useMemo` and disposed on change. Never `setState` inside `useFrame`; mutate refs and buffers instead
- **Randomness:** only through the seeded RNG passed into the engine. Cosmetic randomness in the viewer uses a repeatable hash, so the same log always looks the same
- **Events:** past tense, serialisable, versioned, with a match ID and sequence number (for example `TributeAttacked`, `ZoneClosed`, `HazardStruck`)
- **Protocol messages:** defined as schemas in `shared`. Client commands are imperative (`JoinRoom`, `SendSponsorGift`), server messages describe what happened (`PlayerJoined`, `GiftAccepted`). The protocol carries a version number
- **Access checks:** by Clerk feature (`has({ feature: 'large_formats' })`), not by plan name, and only on the server
- **Tests:** engine rules, geometry helpers, allowance and plan rules, and room rules are tested before they're implemented. Every bug fix gets a regression test
- **Commits:** small, one concern each, with a message saying *why*
- **Learning logs:** the `learning/` folder. Update it at the end of every phase and after each `/autopsy`