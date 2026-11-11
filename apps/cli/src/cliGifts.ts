import type { SponsorGift } from "@arena/shared";

// Turns repeated `--gift round:tributeId:itemId` flags into SponsorGift inputs.
//   --gift 5:t3:medkit --gift 8:t1:arrows
// The CLI only checks the *shape* of each flag. Whether the tribute, item and round are valid
// is the engine's job (resolveGifts throws on unknown tributes/items, wrong rounds, duplicate ids).
export function parseGiftFlags(flags: string[]): SponsorGift[] {
  return flags.map((flag, i) => {
    const parts = flag.split(":");
    if (parts.length !== 3) {
      throw new Error(
        `--gift must look like round:tributeId:itemId (e.g. 5:t3:medkit), got "${flag}"`,
      );
    }
    const [roundText, to, itemDefinitionId] = parts as [string, string, string];
    const appliesInRound = Number(roundText);
    if (!Number.isInteger(appliesInRound) || appliesInRound < 1) {
      throw new Error(`--gift round must be a whole number of 1 or more, got "${roundText}"`);
    }
    return {
      giftId: `cli-gift-${i + 1}`, // unique per run, so the engine's duplicate check never fires
      from: null, // no player in the CLI
      to,
      itemDefinitionId,
      appliesInRound,
    };
  });
}
