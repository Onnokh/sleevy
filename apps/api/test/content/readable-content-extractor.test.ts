import { describe, expect } from "bun:test"
import { Effect, Option } from "effect"

import { ReadableContentExtractor } from "../../src/modules/content/ReadableContentExtractor.js"
import { testEffect } from "../lib/effect.js"

const it = testEffect(ReadableContentExtractor.layer)

const url = "https://example.com/articles/extraction"

const prose = (marker: string) =>
  `<p>${marker} Readability scores a block by its punctuation and its length, so a ` +
  "paragraph has to carry real sentences before it counts toward the article. " +
  "This one carries several, and the page repeats it enough times to clear the " +
  "character floor without any of the site chrome helping.</p>"

const article = (body: string) =>
  [
    "<!doctype html><html><head><title>Extraction</title></head><body>",
    "<nav>Home Docs Pricing</nav>",
    "<article><h1>Extraction</h1>",
    body,
    "</article>",
    "<footer>Cookie notice</footer>",
    "</body></html>",
  ].join("")

const longArticle = article(
  Array.from({ length: 8 }, (_, i) => prose(`Paragraph ${i}.`)).join(""),
)

describe("ReadableContentExtractor", () => {
  it.effect("accepts an article and returns both stored forms", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor

      expect(yield* extractor.isReadable(longArticle, url)).toBe(true)

      const result = yield* extractor.extract(longArticle, url)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isNone(result)) return

      expect(result.value.title).toBe("Extraction")
      expect(result.value.html).toContain("<p>")
      expect(result.value.markdown).toContain("Readability scores a block")
      // The Markdown is prose, not markup.
      expect(result.value.markdown).not.toContain("<p>")
      // Site chrome is not part of the article.
      expect(result.value.markdown).not.toContain("Cookie notice")
      expect(result.value.markdown).not.toContain("Pricing")
    }),
  )

  it.effect("keeps block structure the Reader View has to render", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = article(
        [
          "<h2>A heading</h2>",
          Array.from({ length: 6 }, (_, i) => prose(`Paragraph ${i}.`)).join(""),
          "<ul><li>first</li><li>second</li></ul>",
          "<pre><code>const answer = 42</code></pre>",
          "<blockquote><p>Quoted line.</p></blockquote>",
        ].join(""),
      )

      const result = yield* extractor.extract(html, url)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isNone(result)) return

      const markdown = result.value.markdown
      expect(markdown).toContain("## A heading")
      expect(markdown).toContain("-   first")
      expect(markdown).toContain("```")
      expect(markdown).toContain("const answer = 42")
      expect(markdown).toContain("> Quoted line.")
    }),
  )

  it.effect("resolves relative images and links against the page", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = article(
        [
          Array.from({ length: 6 }, (_, i) => prose(`Paragraph ${i}.`)).join(""),
          '<p><img src="/img/cover.png" alt="Cover"></p>',
          '<p><a href="/part-two">Part two</a></p>',
        ].join(""),
      )

      const result = yield* extractor.extract(html, url)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isNone(result)) return

      // An External Image URL a Reader View on another host can still load.
      expect(result.value.markdown).toContain(
        "![Cover](https://example.com/img/cover.png)",
      )
      expect(result.value.markdown).toContain(
        "[Part two](https://example.com/part-two)",
      )
    }),
  )

  it.effect("rejects a page with no article prose, and stores nothing", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = [
        "<!doctype html><html><head><title>Watch</title></head><body>",
        "<nav>Home Browse</nav>",
        '<div id="player"></div>',
        "<p>1.2M views</p><p>Subscribe</p>",
        "</body></html>",
      ].join("")

      // The gate decides, and it decides alone: a rejected page never reaches
      // the parser.
      expect(yield* extractor.isReadable(html, url)).toBe(false)
    }),
  )

  it.effect("rejects a page below the character floor", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = article("<p>One short line, and then the page ends.</p>")

      expect(yield* extractor.isReadable(html, url)).toBe(false)

      // A thin page produces nothing rather than a fragment, even if the gate
      // is skipped.
      const result = yield* extractor.extract(html, url)
      expect(Option.isNone(result)).toBe(true)
    }),
  )

  it.effect("rejects a tree over the node-count limit before parsing it", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = article(
        longArticle + Array.from({ length: 20_001 }, () => "<span>x</span>").join(""),
      )

      expect(yield* extractor.isReadable(html, url)).toBe(false)
    }),
  )
})
