import type {
  AgentDecision,
  Decide,
  GameEvent,
  GameState,
  RoundActions,
  SponsorGift,
  Tags,
  TributeId,
} from "@arena/shared";
import { MAX_ROUNDS, perceive, remember, resolveRound } from "@arena/sim";

export async function runMatch(
  initialState: GameState,
  decide: Decide,
  gifts: SponsorGift[] = [],
): Promise<{
  state: GameState;
  actions: RoundActions[];
  events: GameEvent[];
  decisions: Record<TributeId, AgentDecision>[];
}> {
  if (initialState.result) throw new Error("Match already ended");

  let state = initialState;
  const actions: RoundActions[] = [];
  const events: GameEvent[] = [];
  const decisions: Record<TributeId, AgentDecision>[] = [];
  const tags: Record<TributeId, Record<TributeId, Tags>> = {};

  while (!state.result) {
    const roundActions: RoundActions = {};
    const roundDecisions: Record<TributeId, AgentDecision> = {};
    if (state.round > MAX_ROUNDS) throw new Error("Match timed out");

    const aliveTributes = state.tributes.filter((t) => t.alive);

    // if one decide rejects, Promise.all rejects and the match stops. 
    // Expected LLM failures are already fallbacks inside decide, 
    // so a rejection here is a bug and should be loud
    const results = await Promise.all(
      aliveTributes.map(async (tribute) => {
        const perception = perceive(state, tribute.tributeId);
        const memory = remember(
          initialState,
          events,
          tribute.tributeId,
          state.round,
        );
        const currentTags = tags[tribute.tributeId] ?? {};
        const decision = await decide(perception, memory, currentTags);
        return [tribute.tributeId, decision] as const;
      }),
    );

    for (const [tributeId, decision] of results) {
      roundActions[tributeId] = decision.action;
      roundDecisions[tributeId] = decision;
      tags[tributeId] = {
        ...tags[tributeId],
        ...roundDecisions[tributeId].tagUpdates,
      };
    }

    const { state: nextState, events: roundEvents } = resolveRound(
      state,
      roundActions,
      gifts,
    );

    state = nextState;
    events.push(...roundEvents);
    actions.push(roundActions);
    decisions.push(roundDecisions);
  }

  return {
    state: state,
    actions: actions,
    events: events,
    decisions: decisions,
  };
}
