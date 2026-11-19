// CLI entry point: turns command-line flags into a MatchConfig, runs the match loop
// with random agents, and prints the result. No game logic lives here.
//
// Usage: npm start -w apps/cli -- --seed 42 --tributes 8 --agent-seed 7 --gift 5:t3:medkit
// Real LLM match (run from the repo root so the key is read from .env, never from a file in git):
//   npx tsx --env-file=.env apps/cli/src/index.ts --agent claude --tributes 8
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import type { AgentDecision, Decide, MatchConfig, TributeId } from "@arena/shared";
import { createMatch, createRng } from "@arena/sim";
import { makeClaudeCallModel, makeDecide, makeRandomDecide } from "@arena/agents";
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
    agent: { type: "string", default: "random" }, // "random" (free, offline) or "claude" (real API calls)
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
const decide = makeAgent(values.agent, config);
const { events, state: finalState, decisions } = await runMatch(
  state,
  decide,
  gifts,
);

// 4. Print. One line per event for now; the narrator (step 12) replaces this later.
for (const event of events) {
  const { type, round, seq, ...details } = event;
  console.log(`[round ${round} #${seq}] ${type} ${JSON.stringify(details)}`);
}
console.log("\nResult:", JSON.stringify(finalState.result, null, 2));
printDecisionSummary(decisions);
console.log(
  `seed=${seed} agentSeed=${agentSeed} tributes=${tributeCount} agent=${values.agent}`,
  gifts.length > 0 ? `gifts=${(values.gift ?? []).join(",")}` : "",
);

// Picks the decide function for --agent. The Claude client reads ANTHROPIC_API_KEY from the
// environment; the key is never logged or passed around here.
function makeAgent(agent: string, config: MatchConfig): Decide {
  if (agent === "random") return makeRandomDecide(createRng(agentSeed));
  if (agent === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("--agent claude needs ANTHROPIC_API_KEY (run with --env-file=.env from the repo root)");
    }
    const names = Object.fromEntries(config.tributes.map((t) => [t.tributeId, t.name]));
    return makeDecide(makeClaudeCallModel(new Anthropic()), config.tributes, names);
  }
  throw new Error(`--agent must be "random" or "claude", got "${agent}"`);
}

// Counts decision sources, fallback reasons and actions across the whole match.
function printDecisionSummary(decisions: Record<TributeId, AgentDecision>[]): void {
  const sources: Record<string, number> = {};
  const fallbackReasons: Record<string, number> = {};
  const actionTypes: Record<string, number> = {};
  let total = 0;
  for (const round of decisions) {
    for (const decision of Object.values(round)) {
      total++;
      sources[decision.source] = (sources[decision.source] ?? 0) + 1;
      actionTypes[decision.action.type] = (actionTypes[decision.action.type] ?? 0) + 1;
      if (decision.source === "fallback") {
        fallbackReasons[decision.reason] = (fallbackReasons[decision.reason] ?? 0) + 1;
      }
    }
  }
  const fallbacks = sources.fallback ?? 0;
  const rate = total > 0 ? ((fallbacks / total) * 100).toFixed(1) : "0.0";
  console.log(`
Decisions: ${total} over ${decisions.length} rounds`);
  console.log("Sources:", sources);
  console.log(`Fallback rate: ${rate}%`, fallbackReasons);
  console.log("Actions:", actionTypes);
}

// Converts a flag's string value to an integer, failing loudly on input like "--seed abc".
function toInt(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error(`${flag} must be an integer, got "${value}"`);
  return n;
}


