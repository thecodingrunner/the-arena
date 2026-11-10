import type { MatchResults, Rng, Tribute, TributeId } from "@arena/shared";
import { MAX_ROUNDS } from "./rules";

export function checkMatchEnd(
  round: number,
  startHp: Record<TributeId, number>,
  endTributes: Tribute[],
  rng: Rng,
): MatchResults | null {
  const aliveTributes = endTributes.filter((t) => t.alive);

  if (aliveTributes.length >= 2 && round < MAX_ROUNDS) return null;

  const endTributesCopy = endTributes.map((t) => ({ ...t }));

  const rngShuffledTributes = rng.shuffle(endTributesCopy);

  const tributeEnduranceRollValues = rngShuffledTributes.reduce(
    (acc, t) => ({ ...acc, [t.tributeId]: t.stats.endurance + rng.int(1, 5) }),
    {} as Record<TributeId, number>,
  );

  const sortedTributes = rngShuffledTributes
    .map((t) => ({
      ...t,
      diedInRound: t.diedInRound === null ? round + 1 : t.diedInRound,
    }))
    .sort(
      (a, b) =>
        b.diedInRound - a.diedInRound ||
        startHp[b.tributeId]! - startHp[a.tributeId]! ||
        b.kills - a.kills ||
        tributeEnduranceRollValues[b.tributeId]! -
          tributeEnduranceRollValues[a.tributeId]!,
    );

  const returnBase = {
    rounds: round,
    winnerId: sortedTributes[0]!.tributeId,
    placements: sortedTributes.map((t) => t.tributeId),
  };

  if (aliveTributes.length === 1) {
    return {
      ...returnBase,
      kind: "lastStanding",
    };
  }

  if (aliveTributes.length === 0) {
    const tiedTributes = sortedTributes.filter((t) => t.diedInRound === round);

    const tiedIds = tiedTributes.map((t) => t.tributeId);

    const rule = decidingRule(tiedTributes, startHp);

    return {
      ...returnBase,
      kind: "tiebreak",
      cause: "draw",
      tiedIds: tiedIds,
      rule: rule,
    };
  }

  const tiedTributes = sortedTributes.filter((t) => t.alive);
  const tiedIds = tiedTributes.map((t) => t.tributeId);

  const rule = decidingRule(tiedTributes, startHp);

  return {
    ...returnBase,
    kind: "tiebreak",
    cause: "timeout",
    tiedIds: tiedIds,
    rule: rule,
  };
}

function decidingRule(
  tiedTributes: Tribute[],
  startHp: Record<TributeId, number>,
): Extract<MatchResults, { kind: "tiebreak" }>["rule"] {
  if (tiedTributes.length < 2) {
    throw new Error("decidingRule needs at least 2 tied tributes");
  }
  if (
    startHp[tiedTributes[0]!.tributeId]! > startHp[tiedTributes[1]!.tributeId]!
  ) {
    return "hp";
  } else if (tiedTributes[0]!.kills > tiedTributes[1]!.kills) {
    return "kills";
  } else {
    return "roll";
  }
}
