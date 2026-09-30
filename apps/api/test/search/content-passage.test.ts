import { describe, expect, test } from "bun:test"

import {
  passageEmbeddingInput,
  splitReadableContent,
} from "../../src/modules/search/ContentPassage.js"

describe("Content Passage splitting", () => {
  test("keeps heading ancestry and Markdown fences", () => {
    const passages = splitReadableContent([
      "# Search",
      "Opening context.",
      "",
      "## Ranking",
      "Keyword and semantic candidates are combined.",
      "",
      "```ts",
      "const heading = '# this is code'",
      "```",
    ].join("\n"), { targetCharacters: 40, maximumCharacters: 120 })

    expect(passages).toEqual([
      {
        ordinal: 0,
        headingPath: "Search",
        content: "Opening context.",
      },
      {
        ordinal: 1,
        headingPath: "Search > Ranking",
        content: "Keyword and semantic candidates are combined.\n\n```ts\nconst heading = '# this is code'\n```",
      },
    ])
  })

  test("bounds a long paragraph", () => {
    const passages = splitReadableContent("word ".repeat(80), {
      targetCharacters: 100,
      maximumCharacters: 120,
    })

    expect(passages.length).toBeGreaterThan(1)
    expect(passages.every((passage) => passage.content.length <= 120)).toBe(true)
  })

  test("adds title and section context only to embedding input", () => {
    const passage = { ordinal: 0, headingPath: "Caching > Invalidation", content: "Purge this key." }
    expect(passageEmbeddingInput("Cache guide", passage)).toBe(
      "Title: Cache guide\nSection: Caching > Invalidation\n\nPurge this key.",
    )
  })
})
