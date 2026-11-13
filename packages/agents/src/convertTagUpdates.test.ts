import { describe, expect, test } from "vitest";
import {
  convertTagUpdates,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_TRIBUTE,
} from "./convertTagUpdates";

// convertTagUpdates
// if the same tributeId appears twice in tagUpdates, the last non-empty one wins (merging conflicts with "replace")
// if tagUpdates contains an unknown tributeId, that entry will be dropped
// if tagUpdates contains the tributes own tributeId, that entry will be dropped
// if there are too many tags (more than MAX_TAGS_PER_TRIBUTE), it will be truncated
// if the tags are above MAX_TAG_LENGTH, the tag will be dropped
// if there is a tag about a tribute that has not yet been seen, that entry will be dropped
// a tribute not in the update change-list keeps its old tags

describe("convertTagUpdates", () => {
  const selfId = "t1";
  const seenIds = new Set(["t2", "t3"]);

  test("if the same tributeId appears twice in tagUpdates, the last non-empty one wins (merging conflicts with 'replace')", () => {
    const tagUpdates = [
      { tributeId: "t3", tags: ["a", "b"] },
      { tributeId: "t3", tags: ["c", "d"] },
    ];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(["c", "d"]);
  });

  test("if tagUpdates contains an unknown tributeId, that entry will be dropped", () => {
    const tagUpdates = [
      { tributeId: "t2", tags: ["a", "b"] },
      { tributeId: "t99", tags: ["c", "d"] },
    ];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t2).toEqual(["a", "b"]);
    expect(result.t99).toBeUndefined();
  });

  test("if tagUpdates contains the tributes own tributeId, that entry will be dropped", () => {
    const tagUpdates = [
      { tributeId: "t2", tags: ["a", "b"] },
      { tributeId: selfId, tags: ["c", "d"] },
    ];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t2).toEqual(["a", "b"]);
    expect(result.t1).toBeUndefined();
  });

  test("if there are too many tags (more than MAX_TAGS_PER_TRIBUTE), it will be truncated", () => {
    const tagUpdates = [{ tributeId: "t3", tags: ["a", "b", "c", "d", "e"] }];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(
      tagUpdates[0]!.tags.slice(0, MAX_TAGS_PER_TRIBUTE),
    );
  });

  test("if the tags are above length MAX_TAG_LENGTH, that tag will be removed", () => {
    const tagUpdates = [
      {
        tributeId: "t3",
        tags: ["a", "b", "x".repeat(MAX_TAG_LENGTH + 1)],
      },
    ];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(["a", "b"]);
  });

  test("if the tags are of length MAX_TAG_LENGTH, that tag will be kept", () => {
    const tagUpdates = [
      {
        tributeId: "t3",
        tags: ["a", "b", "x".repeat(MAX_TAG_LENGTH)],
      },
    ];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(["a", "b", "x".repeat(MAX_TAG_LENGTH)]);
  });

  test("if there is a tag about a tribute that has not yet been seen, that entry will be dropped", () => {
    const tagUpdates = [
      { tributeId: "t3", tags: ["a", "b"] },
      { tributeId: "t4", tags: ["c", "d"] },
    ];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(["a", "b"]);
    expect(result.t4).toBeUndefined();
  });

  test("if the tags are above length MAX_TAG_LENGTH, and there are too many tags (more than MAX_TAGS_PER_TRIBUTE), that long tag will be removed first, then the rest if still necessary", () => {
    const tagUpdates = [
      {
        tributeId: "t3",
        tags: ["a", "b", "x".repeat(MAX_TAG_LENGTH + 1), "c"],
      },
    ];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(["a", "b", "c"]);
  });

  test("if the tags array is empty, it will be skipped (not added), and will therefore not override other tags", () => {
    const tagUpdates = [
      {
        tributeId: "t3",
        tags: ["a", "b", "c"],
      },
      {
        tributeId: "t3",
        tags: [],
      },
    ];

    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(["a", "b", "c"]);
  });

  test("if a tags array only contains tags that are above MAX_TAG_LENGTH, it will be skipped (not added), and will therefore not override other tags", () => {
    const tagUpdates = [
      {
        tributeId: "t3",
        tags: ["a", "b", "c"],
      },
      {
        tributeId: "t3",
        tags: ["x".repeat(MAX_TAG_LENGTH + 1), "x".repeat(MAX_TAG_LENGTH + 1)],
      },
    ];
    
    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(["a", "b", "c"]);
  })

  test("a single empty tags array should give the tribute tags as undefined", () => {
    const tagUpdates = [
      {
        tributeId: "t3",
        tags: [],
      },
    ];
    
    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toBeUndefined();
  });

  test("a tag containing only spaces will be dropped", () => {
    const tagUpdates = [
      {
        tributeId: "t3",
        tags: ["a", "b", "   "],
      },
    ];
    
    const result = convertTagUpdates(tagUpdates, selfId, seenIds);

    expect(result.t3).toEqual(["a", "b"]);
  })

  test.todo("a tribute not in the update change-list keeps its old tags");
});
