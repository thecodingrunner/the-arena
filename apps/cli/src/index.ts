// CLI entry point: turns command-line flags into a MatchConfig, runs the match loop
// with random agents, and prints the result. No game logic lives here.
//
// Usage: npm start -w apps/cli -- --seed 42 --tributes 8 --agent-seed 7 --gift 5:t3:medkit
import { parseArgs } from "node:util";
import type { MatchConfig } from "@arena/shared";
import { createMatch, createRng } from "@arena/sim";
import { randomAgent } from "@arena/agents";
import { runMatch } from "./matchLoop";
import { makeCliTributes } from "./cliTributes";
import { parseGiftFlags } from "./cliGifts";

// 1. Parse flags. parseArgs reads process.argv and returns every value as a string
//    (or undefined if the flag wasn't given), so numbers are converted below.
const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "42" },
    tributes: { type: "string", default: "8" },
    "agent-seed": { type: "string" }, // no default here: it depends on --seed
    arena: { type: "string", default: "placeholder" },
    // multiple: true lets the flag repeat; values.gift is then a string[] (or undefined)
    gift: { type: "string", multiple: true },
  },
});

const seed = toInt(values.seed, "--seed");
const tributeCount = toInt(values.tributes, "--tributes");
// Default agent seed is seed + 1: reproducible, but separate from the engine's seed.
const agentSeed =
  values["agent-seed"] === undefined
    ? seed + 1
    : toInt(values["agent-seed"], "--agent-seed");

// 2. Build the MatchConfig. createMatch validates it (tribute count, ids, weapons, arena),
//    so the CLI only needs to produce something well-formed.
const gifts = parseGiftFlags(values.gift ?? []);

const config: MatchConfig = {
  matchId: `cli-${seed}`,
  seed,
  arenaId: values.arena,
  tributes: makeCliTributes(tributeCount),
};

// 3. Run. The engine gets its RNG from the config seed (inside createMatch);
//    the agents get their own RNG, so agent choices never use up engine draws.
const state = createMatch(config);
const agentRng = createRng(agentSeed);
const { events, state: finalState } = runMatch(
  state,
  (p) => randomAgent(p, agentRng),
  gifts,
);

// 4. Print. One line per event for now; the narrator (step 12) replaces this later.
for (const event of events) {
  const { type, round, seq, ...details } = event;
  console.log(`[round ${round} #${seq}] ${type} ${JSON.stringify(details)}`);
}
console.log("\nResult:", JSON.stringify(finalState.result, null, 2));
console.log(
  `seed=${seed} agentSeed=${agentSeed} tributes=${tributeCount}`,
  gifts.length > 0 ? `gifts=${(values.gift ?? []).join(",")}` : "",
);

// Converts a flag's string value to an integer, failing loudly on input like "--seed abc".
function toInt(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error(`${flag} must be an integer, got "${value}"`);
  return n;
}


