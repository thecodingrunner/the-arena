import {
  arenaDefinitions,
  weaponDefinitions,
  type GameState,
  type MatchConfig,
  type Tribute,
  type TributeConfig,
  type ZoneId,
} from "@arena/shared";
import { createRng } from "./rng";
import { STARTING_HP, STARTING_HUNGER } from "./rules";

export function createMatch({
  matchId,
  seed,
  arenaId,
  tributes,
}: MatchConfig): GameState {
  if (tributes.length < 2) {
    throw new Error("Must have at least 2 tributes");
  }
  const tributeIdMap = new Map();
  for (let i = 0; i < tributes.length; i++) {
    if (tributeIdMap.has(tributes[i]?.tributeId)) {
      throw new Error("TributeIds must be unique");
    }
    tributeIdMap.set(tributes[i]?.tributeId, i);

    if (
      !weaponDefinitions.find(
        (weapon) =>
          tributes[i]?.startingWeaponDefId === weapon.weaponDefinitionId,
      )
    ) {
      throw new Error("Invalid startingWeaponDefId");
    }
  }
  if (matchId === "") {
    throw new Error("matchId cannot be empty");
  }

  let nextItemId = 0;

  const arena = arenaDefinitions.find((a) => a.arenaId === arenaId);
  if (!arena) {
    throw new Error("Unknown arenaId");
  }

  const starts = arena.startingZoneIds;
  const slots = tributes.map((_, i) => starts[i % starts.length] as ZoneId);

  const rng = createRng(seed);
  const shuffledSlots = rng.shuffle(slots);

  const zones = arena.zones.map((z) => ({ ...z }));
  // this is a deep copy, and works because zones don't
  // contain objects (exactly deep enough)

  const builtTributes = tributes.map((tribute: TributeConfig, i) => {
    const builtTribute: Tribute = {
      ...tribute,
      hp: STARTING_HP,
      hunger: STARTING_HUNGER,
      position: shuffledSlots[i] as ZoneId,
      alive: true,
      inventory: [
        {
          kind: "weapon",
          itemId: `${tribute.startingWeaponDefId}-${nextItemId}`,
          definitionId: tribute.startingWeaponDefId,
          ammunition:
            weaponDefinitions.find(
              (w) => w.weaponDefinitionId === tribute.startingWeaponDefId,
            )?.startingAmmunition ?? null,
        },
      ],
      memory: [],
      hiding: false,
      kills: 0,
      diedInRound: null,
    };

    nextItemId++;

    return builtTribute;
  });

  return {
    tributes: builtTributes,
    zones: zones,
    alliances: [], // e.g. { id, memberIds: [3, 7] }
    matchId: matchId,
    seq: 0,
    round: 0,
    rngState: rng.getState(),
    nextItemId: nextItemId,
    arenaId: arenaId,
    result: null,
  };
}
