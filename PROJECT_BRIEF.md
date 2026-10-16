# Project Brief: "The Arena" — AI Survival Game

> Working title. Avoid "Hunger Games" in code, UI and branding — it's a protected brand.

## How we work on this project (read first)

This project is being built with **Manware's AI Learning Toolkit** (see `CLAUDE.md` and `.claude/commands/`). The goal is for me (Finn) to *learn* while building, not to receive finished code.

- **I write the code.** You guide, question, hint and review. Follow the toolkit's rules: I try first, I predict, you hint one level at a time.
- **Default to learning mode** for anything in the core of the game: the simulation engine, agent decision loop, combat rules, game-state types, multiplayer sync, and the playback/animation logic.
- **Shipping mode is fine** (when I say "ship this") for low-learning-value chores: project scaffolding, config files, linting/formatting setup, Docker/Coolify deploy config, boilerplate UI components, and asset-pipeline glue.
- When a phase starts, begin with `/arch` so I design it before coding. When I hit a new library (React Three Fiber, a WebSocket library, an LLM SDK), use `/api`.
- After non-trivial bugs, prompt me to run `/autopsy`, and log lessons in `learning/`.
- Ask **one question at a time**. Don't front-load long explanations.

## About me

- Junior frontend developer, ~2.5 years experience.
- Strong: React, Next.js, TypeScript, Tailwind. Some Three.js experience.
- New to: game simulation design, LLM agent loops, real-time multiplayer, 3D character morphing.
- Self-host on a Hetzner VPS with Coolify, Docker and Nginx.
- Pitch new concepts at the level of someone who knows the web stack well but hasn't built games.

## The game

Players each create a **tribute**, then watch AI-controlled tributes fight to survive in an arena. The last one alive wins.

1. **Lobby (multiplayer):** players join a room. Each builds one tribute; empty slots are filled with AI-generated tributes (e.g. 12 or 24 total).
2. **Character creation:**
   - Drag points on a **radar chart** (strength, agility, stealth, intelligence, endurance, charisma) with a fixed point budget so every build has trade-offs.
   - Pick a **weapon** (each has strengths/weaknesses against stats).
   - Write a short **personality prompt** (e.g. "paranoid loner, never trusts anyone") that genuinely shapes the AI's behaviour.
   - A **3D model** previews the tribute and morphs with stats (more strength → more muscular).
3. **Map selection:** e.g. jungle, dystopian city. Each map is a set of zones.
4. **The match:** tributes are markers moving across the map. An **announcer feed** narrates what's happening.
5. **Sponsoring:** during the match, players spend limited sponsor points to send items (food, medicine, weapons) to tributes, which affects later rounds.

## Core architecture decisions (already agreed)

### 1. Rules engine and AI are strictly separated
- **Rules engine** (pure TypeScript, deterministic given a seed): owns all truth — positions, health, hunger, inventory, combat resolution (stats + weapon modifiers + seeded dice), hazards, deaths.
- **LLM agents only choose intent** from a fixed action menu via structured output (JSON schema / tool calling), e.g. `forage`, `hunt(target)`, `hide`, `rest`, `move_to(zone)`, `propose_alliance(target)`, `betray(ally)`, `flee`, `use_item(item)`.
- The engine **validates** every action. Invalid or malformed choices fall back to a sensible default. The LLM never decides outcomes ("I try to ambush X", not "I kill X").
- This also contains prompt injection from player personality prompts: whatever the LLM says, only valid actions get through.

### 2. Round-based simulation with a buffer
- The game runs in **rounds** (e.g. day/night phases).
- Each round: build each living tribute's perception snapshot → call LLMs in parallel → resolve actions in the engine → emit events.
- Because of **sponsoring**, we can't pre-simulate the entire match. Instead the server simulates a **few rounds ahead** of what's being shown. Sponsor gifts apply at the next unsimulated round boundary.
- Every match is stored as a **seed + event log**, which enables replays and debugging.

### 3. Narrator
- A separate LLM call turns each round's event log into announcer commentary. Purely cosmetic: it never changes state.

### 4. Map as a zone graph
- Maps are graphs of zones (river, cornucopia, ruins, etc.) with properties: food, water, cover, hazard level, adjacency.
- Movement is zone-to-zone; the client interpolates marker positions for smooth animation.
- Arena events (flooding, closing zones) push tributes together late-game.

### 5. Server-authoritative multiplayer
- The simulation and LLM calls run on the server only. Clients receive events and render them.
- Real-time transport for lobbies, event streaming and sponsor actions (WebSockets; library to be chosen in an `/arch` / `/api` session).

### 6. Agent memory
- Each tribute keeps a short memory list (e.g. "Tribute 7 betrayed me", "the river zone has food") that's fed back into its prompt, capped to keep tokens low.

## Suggested stack (open to discussion)

- **Frontend:** Next.js + TypeScript + Tailwind, React Three Fiber + drei for 3D, Zustand for client state.
- **Simulation:** a shared TypeScript package (`packages/sim`) with no framework dependencies so it's unit-testable.
- **Server:** Node service for the game loop, LLM calls and WebSockets.
- **Database:** Postgres for users, lobbies and saved matches.
- **3D assets:** Blender base mesh with shape keys (muscular, lean, heavy, tall), exported as glTF; weapons as separate meshes attached to the hand bone.
- **Deploy:** Docker on Hetzner via Coolify.
- **LLM:** a fast, cheap model for agent decisions; possibly a stronger one for narration.

## Roadmap

Each phase should be playable/testable before moving on. Don't start graphics until Phase 1 is fun.

1. **Text-only simulator (CLI):** types, rules engine, seeded RNG, LLM decision loop, narrator, event log printed to the terminal. *Success = reading the log is entertaining.*
2. **2D zone map + playback:** web UI showing markers moving between zones with the announcer feed, driven by a stored event log.
3. **Character creator:** radar chart with point budget, weapon picker, personality prompt (with length limits).
4. **Multiplayer lobbies + sponsoring:** rooms, real-time event streaming, round buffer, sponsor items.
5. **3D:** morphing character model in the creator, then a 2.5D arena view.

## Where to start

Start a `/arch` session for **Phase 1**. The first things I need to design myself:
1. The core data model: `Tribute`, `Stats`, `Weapon`, `Zone`, `Map`, `Action`, `GameEvent`, `GameState`.
2. The shape of one round: perception → decision → validation → resolution → events.
3. What goes into an agent's prompt, and the JSON schema for its response.

Then help me set up `/test` for the rules engine before I implement combat resolution.