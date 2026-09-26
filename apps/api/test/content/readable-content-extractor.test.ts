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

  it.effect("keeps a table as a table, with its rows intact", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = article(
        [
          Array.from({ length: 6 }, (_, i) => prose(`Paragraph ${i}.`)).join(""),
          "<table>",
          "<thead><tr><th>Desired quality</th><th>Established terminology</th></tr></thead>",
          "<tbody>",
          "<tr><td>Types enforce invariants</td><td>Type-driven design</td></tr>",
          "<tr><td>Guards leave early</td><td>Fail-fast design</td></tr>",
          "</tbody></table>",
        ].join(""),
      )

      const result = yield* extractor.extract(html, url)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isNone(result)) return

      // Turndown carries no table rule of its own: without the plugin every one
      // of these cells became a paragraph of its own, and nothing said which
      // quality paired with which term.
      const markdown = result.value.markdown
      expect(markdown).toContain("| Desired quality | Established terminology |")
      expect(markdown).toContain("| Types enforce invariants | Type-driven design |")
      expect(markdown).toContain("| Guards leave early | Fail-fast design |")
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
  // Every shape below was taken from a real page in the corpus.
  it.effect("drops the permalink affordance a heading carries", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = article(
        [
          '<h2><a href="#what-we-built">Copy link to heading</a>What we built</h2>',
          Array.from({ length: 6 }, (_unused, i) => prose(`Paragraph ${i}.`)).join(""),
        ].join(""),
      )

      const result = yield* extractor.extract(html, url)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isNone(result)) return

      // The heading reads as its own title, not as the button beside it — in
      // the Reader View, the search index, and the summarizer's input alike.
      expect(result.value.markdown).toContain("## What we built")
      expect(result.value.markdown).not.toContain("Copy link to heading")
    }),
  )

  it.effect("keeps the words of an in-page anchor and drops the link", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = article(
        [
          '<p>This guide assumes familiarity with <a href="#relations">Relations</a>.</p>',
          Array.from({ length: 6 }, (_unused, i) => prose(`Paragraph ${i}.`)).join(""),
        ].join(""),
      )

      const result = yield* extractor.extract(html, url)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isNone(result)) return

      // An anchor into the original page's own contents cannot resolve here.
      expect(result.value.markdown).toContain("familiarity with Relations")
      expect(result.value.markdown).not.toContain("](#relations)")
    }),
  )

  it.effect("keeps the language a highlighter left on a code block", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      const html = article(
        [
          Array.from({ length: 6 }, (_unused, i) => prose(`Paragraph ${i}.`)).join(""),
          '<pre><code data-language="python">print("hi")</code></pre>',
          '<pre data-lang="go"><code>fmt.Println("hi")</code></pre>',
          "<pre><code>no language here</code></pre>",
        ].join(""),
      )

      const result = yield* extractor.extract(html, url)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isNone(result)) return

      const markdown = result.value.markdown
      // Sites disagree about where the language goes, and only the data
      // attributes survive Readability — a `language-*` class does not, which
      // is why none of the stored corpus carries one.
      expect(markdown).toContain("```python")
      expect(markdown).toContain("```go")
      // An unlabelled block stays unlabelled rather than being guessed at.
      expect(markdown).toContain("```\nno language here")
    }),
  )
  it.effect("promotes a card-shaped link onto its heading", () =>
    Effect.gen(function* () {
      const extractor = yield* ReadableContentExtractor
      // An index page wraps the whole card in one anchor. A Markdown link holds
      // inline content only, so this used to emit a bare "[" and "](url)" that
      // reached the reader as literal characters.
      const html = article(
        [
          Array.from({ length: 6 }, (_unused, i) => prose(`Paragraph ${i}.`)).join(""),
          '<a href="https://example.com/blog/microfilm">',
          "<p>09/01/2026 Engineering</p>",
          "<h2>Microfilm</h2>",
          "<p>A Gradle plugin for Android image resource compression</p>",
          "<p>Patrick Tyska</p>",
          "</a>",
        ].join(""),
      )

      const result = yield* extractor.extract(html, url)
      expect(Option.isSome(result)).toBe(true)
      if (Option.isNone(result)) return

      const markdown = result.value.markdown
      // The heading carries the link the card was pointing at.
      expect(markdown).toContain("## [Microfilm](https://example.com/blog/microfilm)")
      // And no bracket is left stranded on a line of its own.
      expect(markdown).not.toMatch(/^\[\s*$/m)
      expect(markdown).not.toMatch(/^\]\(/m)
      expect(markdown).toContain("Patrick Tyska")
    }),
  )
})
