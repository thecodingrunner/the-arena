import type {
  Action,
  GameEvent,
  GameState,
  Perception,
  RoundActions,
} from "@arena/shared";
import { perceive, resolveRound } from "@arena/sim";
import { MAX_ROUNDS } from "@arena/sim/src/rules";

export function runMatch(
  initialState: GameState,
  decide: (perception: Perception) => Action,
): {
  state: GameState;
  actions: RoundActions[];
  events: GameEvent[];
} {
  if (initialState.result) throw new Error("Match already ended");

  let state = initialState;
  const actions: RoundActions[] = [];
  const events: GameEvent[] = [];

  while (!state.result) {
    const roundActions: RoundActions = {};
    if (state.round > MAX_ROUNDS) throw new Error("Match timed out");

    const aliveTributes = state.tributes.filter((t) => t.alive);
    for (const tribute of aliveTributes) {
      const perception = perceive(state, tribute.tributeId);
      const action = decide(perception);
      roundActions[tribute.tributeId] = action;
    }
    const { state: nextState, events: roundEvents } = resolveRound(
      state,
      roundActions,
    );
    state = nextState;
    events.push(...roundEvents);
    actions.push(roundActions);
  }

  return {
    state: state,
    actions: actions,
    events: events,
  };
}
