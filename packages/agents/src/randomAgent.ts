import type { Action, Perception, Rng } from "@arena/shared";

export function randomAgent(perception: Perception, agentRng: Rng): Action {
  // hunting scales with crowd size, agent's bias is not a property of the engine

  const actions: Action[] = [
    {
      type: "rest",
    },
    {
      type: "hide",
    },
    {
      type: "forage",
    },
  ];

  for (const tribute of perception.visibleTributes) {
    actions.push({
      type: "hunt",
      targetId: tribute.tributeId,
    });
  }

  for (const zoneId of perception.adjacentZoneIds) {
    actions.push({
      type: "move_to",
      zoneId,
    });
  }

  const action = agentRng.pick(actions);

  return action;
}
