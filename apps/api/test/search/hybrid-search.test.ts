import { describe, expect, test } from "bun:test"

import type { LinkId, SavedItemId } from "../../src/domain/SavedItem.js"
import { fuseSearchCandidates } from "../../src/modules/search/HybridSearch.js"
import type { SearchCandidate } from "../../src/modules/search/HybridSearchRepository.js"

const candidate = (
  savedItemId: string,
  linkId: string,
  ordinal: number,
  content = "A relevant passage.",
): SearchCandidate => ({
  savedItemId: savedItemId as SavedItemId,
  linkId: linkId as LinkId,
  ordinal,
  title: "Result",
  url: `https://example.com/${linkId}`,
  host: "example.com",
  headingPath: "Section",
  content,
  score: 1,
})

describe("hybrid search fusion", () => {
  test("promotes a passage found by both retrieval methods", () => {
    const shared = candidate("saved-1", "link-1", 0)
    const results = fuseSearchCandidates(
      [candidate("saved-2", "link-2", 0), shared],
      [shared, candidate("saved-3", "link-3", 0)],
      3,
    )

    expect(String(results[0]?.linkId)).toBe("link-1")
    expect(results[0]?.matchedBy).toBe("both")
  })

  test("caps one Saved Item at two passages", () => {
    const results = fuseSearchCandidates(
      [candidate("saved-1", "link-1", 0), candidate("saved-1", "link-1", 1), candidate("saved-1", "link-1", 2)],
      [candidate("saved-2", "link-2", 0)],
      4,
    )

    expect(results.filter((result) => result.savedItemId === "saved-1")).toHaveLength(2)
    expect(results.some((result) => result.savedItemId === "saved-2")).toBe(true)
  })

  test("returns bounded plain-text excerpts", () => {
    const [result] = fuseSearchCandidates(
      [candidate("saved-1", "link-1", 0, "word\n".repeat(300))],
      [],
      1,
    )

    expect(result?.excerpt.length).toBeLessThanOrEqual(700)
    expect(result?.excerpt).not.toContain("\n")
  })
})
