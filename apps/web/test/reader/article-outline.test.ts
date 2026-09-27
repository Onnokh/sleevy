import { describe, expect, test } from "bun:test"

import { articleOutline } from "../../src/sleevy/article-outline"
import { READING_LINE, activeOutlineIndex } from "../../src/hooks/use-outline-position"

/// Both halves of the Article Outline are pure and platform-free on purpose:
/// they are the part the iOS app re-implements rather than re-designs, so what
/// they promise is written down here rather than left to whichever client was
/// read first.

const sections = (...titles: readonly string[]) =>
  titles.map((title) => `## ${title}\n\nA paragraph under ${title}.`).join("\n\n")

describe("articleOutline", () => {
  test("takes the shallowest level that carries enough headings", () => {
    // The h1 is the article's own title and the sections are under it. Taking
    // the shallowest level outright would answer with a rail of one mark and
    // lose the outline the article really has.
    const markdown = ["# Built for humans", sections("First", "Second", "Third")].join("\n\n")

    expect(articleOutline(markdown).map((entry) => entry.title)).toEqual([
      "First",
      "Second",
      "Third",
    ])
  })

  test("has no outline for an article with too few headings to be one", () => {
    expect(articleOutline(sections("Only", "Two"))).toEqual([])
    expect(articleOutline("Prose with no headings at all.")).toEqual([])
  })

  test("ignores a heading inside a fenced code block", () => {
    const markdown = [
      sections("First", "Second", "Third"),
      "```sh",
      "# install it first",
      "## not a section",
      "```",
    ].join("\n\n")

    expect(articleOutline(markdown).map((entry) => entry.title)).toEqual([
      "First",
      "Second",
      "Third",
    ])
  })

  test("reads a heading as the words it renders as", () => {
    const markdown = [
      "## [Microfilm](https://example.com/blog/microfilm)",
      "\nWhat the card was pointing at.",
      sections("Second", "Third"),
    ].join("\n")

    const [first] = articleOutline(markdown)
    expect(first?.title).toBe("Microfilm")
    expect(first?.id).toBe("microfilm")
  })

  test("gives two sections of the same name two ids", () => {
    const outline = articleOutline(sections("Notes", "Other", "Notes"))
    expect(outline.map((entry) => entry.id)).toEqual(["notes", "other", "notes-2"])
  })

  test("points back at the heading's own line, not at its slug", () => {
    const markdown = ["Intro.", "", "## First", "", "Body.", "", "## Second", "", "Body.", "", "## Third"].join("\n")
    // The renderer matches a heading it is drawing to its entry by this line,
    // so it has to be the line the heading is really on.
    expect(articleOutline(markdown).map((entry) => entry.line)).toEqual([3, 7, 11])
  })

  test("carries the opening of each section, and nothing when there is none", () => {
    const markdown = [
      "## First",
      "",
      "The first thing the section says.",
      "",
      "## Second",
      "### Straight into a sub-heading",
      "",
      "## Third",
      "",
      "- A list opens this one.",
    ].join("\n")

    expect(articleOutline(markdown).map((entry) => entry.excerpt)).toEqual([
      "The first thing the section says.",
      "",
      "A list opens this one.",
    ])
  })
})

describe("activeOutlineIndex", () => {
  const tops = [1000, 2000, 3000]
  const viewport = 800

  test("marks the first section at the top of the article", () => {
    // A rail that opens with nothing lit reads as one that is not working, and
    // a reader above the first heading is on their way into that section
    // rather than into any other.
    expect(activeOutlineIndex(tops, 0, viewport, 4000)).toBe(0)
  })

  test("moves on as each heading reaches the reading line", () => {
    expect(activeOutlineIndex(tops, 1000 - READING_LINE - 1, viewport, 9000)).toBe(0)
    expect(activeOutlineIndex(tops, 1000 - READING_LINE, viewport, 9000)).toBe(0)
    expect(activeOutlineIndex(tops, 2000 - READING_LINE - 1, viewport, 9000)).toBe(0)
    expect(activeOutlineIndex(tops, 2000 - READING_LINE, viewport, 9000)).toBe(1)
    expect(activeOutlineIndex(tops, 3000 - READING_LINE, viewport, 9000)).toBe(2)
  })

  test("claims the last section at the end of the article", () => {
    // A closing section shorter than the reading line is deep never travels far
    // enough to claim its own mark, so the rail would stop one short however
    // far the reader scrolled.
    expect(activeOutlineIndex([100, 200, 3950], 3200, viewport, 4000)).toBe(2)
  })

  test("has no answer for an article with no outline", () => {
    // The only -1 there is, and an article with no outline draws no rail for
    // it to answer for.
    expect(activeOutlineIndex([], 0, viewport, 4000)).toBe(-1)
  })
})
