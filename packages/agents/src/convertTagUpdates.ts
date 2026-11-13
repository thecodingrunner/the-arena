import type { Tags, TributeId } from "@arena/shared";

export const MAX_TAGS_PER_TRIBUTE = 3;
export const MAX_TAG_LENGTH = 30;

export function convertTagUpdates(
  tagUpdates: { tributeId: string; tags: string[] }[],
  selfId: TributeId,
  seenIds: ReadonlySet<TributeId>,
): Record<TributeId, Tags> {
  const result: Record<TributeId, Tags> = {};

  for (const { tributeId, tags } of tagUpdates) {
    if (!seenIds.has(tributeId) || tributeId === selfId) {
      continue;
    }

    const tagsToAdd = tags
        .filter((tag) => tag.length <= MAX_TAG_LENGTH)
        .filter((tag) => tag.trim().length > 0)
        .slice(0, MAX_TAGS_PER_TRIBUTE); 

    if (tagsToAdd.length === 0) {
      continue;
    }

    result[tributeId] = tagsToAdd;
  }

  return result;
}
