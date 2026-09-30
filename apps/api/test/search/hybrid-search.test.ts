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
      "a contextual question",
    )

    expect(String(results[0]?.linkId)).toBe("link-1")
    expect(results[0]?.matchedBy).toBe("both")
  })

  test("caps one Saved Item at two passages", () => {
    const results = fuseSearchCandidates(
      [candidate("saved-1", "link-1", 0), candidate("saved-1", "link-1", 1), candidate("saved-1", "link-1", 2)],
      [candidate("saved-2", "link-2", 0)],
      4,
      "a contextual question",
    )

    expect(results.filter((result) => result.savedItemId === "saved-1")).toHaveLength(2)
    expect(results.some((result) => result.savedItemId === "saved-2")).toBe(true)
  })

  test("returns bounded plain-text excerpts", () => {
    const [result] = fuseSearchCandidates(
      [candidate("saved-1", "link-1", 0, "word\n".repeat(300))],
      [],
      1,
      "a contextual question",
    )

    expect(result?.excerpt.length).toBeLessThanOrEqual(700)
    expect(result?.excerpt).not.toContain("\n")
  })

  test("ranks a phrase above loose matches found by both methods", () => {
    const loose = candidate("saved-loose", "link-loose", 0, "Parse input and validate the output.")
    const exact = candidate("saved-exact", "link-exact", 0, "Read [Parse, Don't Validate](https://example.com/guide).")
    const results = fuseSearchCandidates([loose, exact], [loose, exact], 2, "Parse, Don’t Validate")

    expect(String(results[0]?.linkId)).toBe("link-exact")
  })

  test("recognizes phrases in titles and headings without matching word fragments", () => {
    const fragment = candidate("saved-fragment", "link-fragment", 0, "We discuss unstable interfaces.")
    const heading = { ...candidate("saved-heading", "link-heading", 0), headingPath: "Stable interfaces" }
    const title = { ...candidate("saved-title", "link-title", 0), title: "Stable Interfaces: a guide" }
    const results = fuseSearchCandidates([fragment, heading, title], [fragment], 3, "stable interfaces")

    expect(results.slice(0, 2).map((result) => String(result.linkId))).toEqual(["link-heading", "link-title"])
  })
})
