import { Readability, isProbablyReaderable } from "@mozilla/readability"
import { tables } from "@joplin/turndown-plugin-gfm"
import { Context, Data, Effect, Layer, Option } from "effect"
import TurndownService from "turndown"

import { parseHtml, type HtmlDocument } from "../../lib/html.js"

/**
 * The article prose of one page, in the two forms Readable Content is stored
 * as. The pair is produced together or not at all: there is no state where one
 * form exists without the other.
 */
type TurndownNode = {
  readonly nodeName: string
  readonly parentNode?: TurndownNode | null
  readonly firstChild?: TurndownNode | null
  readonly textContent?: string | null
  readonly getAttribute?: (name: string) => string | null
  readonly querySelector?: (selectors: string) => unknown
}

export type ExtractedArticle = {
  readonly html: string
  readonly markdown: string
  readonly title?: string
}

/**
 * The gate's thresholds. A block under this many characters does not count, and
 * the blocks that do count must accumulate this much score before the page is
 * worth parsing. Both are Readability's own defaults, named here because the
 * gate is the only thing that decides.
 */
const MIN_CONTENT_LENGTH = 140
const MIN_SCORE = 20

/**
 * The character floor, so a thin page yields no Readable Content rather than a
 * fragment of one.
 *
 * Readability's own charThreshold only decides whether to retry with looser
 * flags; when the retries run out it returns the best attempt whatever its
 * length. The floor is therefore enforced here as well as passed in.
 */
const CHAR_THRESHOLD = 500

/**
 * Enrichment runs against URLs anyone may submit, and both Readability ports
 * default to parsing an unbounded tree. An article does not need this many
 * elements; a page that does is not an article.
 */
const MAX_ELEMENTS = 20_000

/**
 * Per-form size ceilings. Article HTML routinely runs several times the size of
 * the Markdown converted from it, so the two numbers are not the same.
 *
 * A page over either ceiling stores nothing. Truncating the HTML would cut it
 * mid-tag and break the re-conversion the column exists for, and truncating one
 * form without the other would leave the pair disagreeing.
 */
export const READABLE_HTML_MAX_CHARS = 1_000_000
export const READABLE_MARKDOWN_MAX_CHARS = 250_000

export class ReadableContentExtractorError extends Data.TaggedError(
  "ReadableContentExtractorError",
)<{
  readonly operation: string
  readonly url: string
  readonly cause: unknown
}> {}

/**
 * Readability resolves relative hrefs against the document's own base, and
 * linkedom gives a parsed string no base at all. Without this every image and
 * link in the article stays relative, and a Reader View on another host cannot
 * load either.
 */
const withBaseUrl = (document: HtmlDocument, url: string): HtmlDocument => {
  for (const key of ["baseURI", "documentURI"] as const) {
    Object.defineProperty(document, key, { value: url, configurable: true })
  }
  return document
}

const HEADINGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"])

/** Elements that cannot sit inside a Markdown link. */
const BLOCK_SELECTOR =
  "p, div, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, figure, section, article, table, hr"

const isInPageAnchor = (node: TurndownNode) =>
  node.nodeName === "A" && (node.getAttribute?.("href") ?? "").startsWith("#")

const isInsideHeading = (node: TurndownNode) => {
  let parent = node.parentNode
  while (parent) {
    if (HEADINGS.has(parent.nodeName)) return true
    parent = parent.parentNode
  }
  return false
}

/**
 * The language a highlighter left on a code block. Sites disagree about where
 * it goes — on the `code`, on the `pre`, as a class or as a data attribute — so
 * every shape seen in the corpus is checked before giving up.
 */
const languageOf = (node: TurndownNode | null | undefined): string => {
  if (!node) return ""

  // A data attribute holds the language as its whole value.
  for (const attribute of ["data-language", "data-lang"]) {
    const value = node.getAttribute?.(attribute)?.trim()
    if (value && /^[a-z0-9+#-]+$/i.test(value)) return value.toLowerCase()
  }

  // A class holds it behind a prefix, and carries unrelated classes beside it.
  const match = (node.getAttribute?.("class") ?? "").match(
    /(?:^|\s)(?:language|lang|highlight-source|highlight)-([a-z0-9+#]+)/i,
  )
  return match?.[1]?.toLowerCase() ?? ""
}

const createTurndown = () => {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  })
  // Readability keeps these when a page wraps prose in them, and none of them
  // survives a Markdown conversion in a form worth reading.
  turndown.remove(["style", "script", "noscript"])

  // A permalink affordance sitting inside a heading. Vercel's reads "Copy link
  // to heading" and appeared 17 times in one article, ahead of every real
  // heading — in the Reader View, in the search index, and in the text the
  // summarizer reads. It is chrome, so it goes.
  turndown.addRule("headingPermalink", {
    filter: (node) => isInPageAnchor(node) && isInsideHeading(node),
    replacement: () => "",
  })

  // A line break inside a heading. Sites break a display heading across lines to
  // control where it wraps, and turndown answers a `br` with a Markdown hard
  // break — two spaces and a newline. A Markdown heading is one line, so the
  // break ended it: everything after it fell out of the heading and became a
  // paragraph of its own. On one page that paragraph was the word "b.", which
  // read as a typo in the prose rather than as the rest of "Built for
  // humans. Readable by AI."
  //
  // Twenty-one headings across ten hosts in the stored corpus were cut this
  // way. The break is where the line wrapped, not a sentence boundary, so the
  // two halves are rejoined with a space.
  turndown.addRule("lineBreakInsideHeading", {
    filter: (node) => node.nodeName === "BR" && isInsideHeading(node),
    replacement: () => " ",
  })

  // An anchor into the original page's own table of contents. It cannot resolve
  // in a Reader View, so the words stay and the link does not.
  turndown.addRule("inPageAnchor", {
    filter: (node) => isInPageAnchor(node) && !isInsideHeading(node),
    replacement: (content) => content,
  })

  // A card on an index page — date, heading, image, byline — wrapped in one
  // anchor. Markdown links hold inline content only, so turndown emits a "[" and
  // a "](url)" around block text and both leak into the reader as literal
  // characters. Seven articles carried sixteen of them, ten on one blog index.
  //
  // The link is promoted onto the card's heading where there is one, which is
  // what the card was pointing at anyway, and dropped where there is not.
  turndown.addRule("blockLevelLink", {
    filter: (node) =>
      node.nodeName === "A" &&
      Boolean(node.getAttribute?.("href")) &&
      Boolean(node.querySelector?.(BLOCK_SELECTOR)),
    replacement: (content, node) => {
      const body = content.trim()
      if (body.length === 0) return ""

      const href = (node as TurndownNode).getAttribute?.("href") ?? ""
      const heading = body.match(/^(#{1,6}) (.+)$/m)
      const linked =
        heading && href
          ? body.replace(heading[0], `${heading[1]} [${heading[2]}](${href})`)
          : body

      return `\n\n${linked}\n\n`
    },
  })

  // Turndown only reads the language off the `code` element's class. Readability
  // runs first with keepClasses off and strips those classes, so in the stored
  // corpus no article kept one — the data attributes did, on six. Keeping the
  // classes was measured at +19% article HTML for no language recovered on a
  // real page, so the attributes that survive are read instead.
  turndown.addRule("fencedCodeWithLanguage", {
    filter: (node) =>
      node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = node.firstChild
      const language = languageOf(code) || languageOf(node)
      const text = (code?.textContent ?? "").replace(/\n+$/, "")
      return `\n\n\`\`\`${language}\n${text}\n\`\`\`\n\n`
    },
  })

  // Turndown has no table rule of its own, so every cell of every table fell
  // through to the default and became its own paragraph. A benchmark table on
  // one page became 225 one-word paragraphs; a two-column reference table on
  // another became 24 paragraphs with nothing to say which term paired with
  // which quality. A third of the corpus carries at least one table.
  //
  // Applied last, because turndown gives the newest rule priority and the plugin
  // must own TABLE, TR, and the cells. It claims no node the rules above claim.
  turndown.use(tables)

  return turndown
}

const nonBlank = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export class ReadableContentExtractor extends Context.Service<ReadableContentExtractor>()(
  "@app/modules/content/ReadableContentExtractor",
  {
    make: Effect.gen(function* () {
      const turndown = createTurndown()

      return {
        /**
         * Convert stored article HTML to Markdown again, without fetching the
         * page. This is what the HTML column is for: a converter fix reaches
         * every Link already extracted, and the Reader View, the search index,
         * and the summarizer's input all improve together.
         */
        convert: Effect.fn("ReadableContentExtractor.convert")(function* (
          html: string,
        ) {
          return yield* Effect.try({
            try: () => turndown.turndown(html).trim(),
            catch: (cause) =>
              new ReadableContentExtractorError({
                operation: "convert",
                url: "",
                cause,
              }),
          })
        }),

        /**
         * The gate. Cheap, and the only thing that decides: a page this rejects
         * stores nothing at all, rather than storing a body and marking it
         * absent.
         */
        isReadable: Effect.fn("ReadableContentExtractor.isReadable")(function* (
          html: string,
          url: string,
        ) {
          yield* Effect.annotateCurrentSpan("url", url)
          return yield* Effect.try({
            try: () => {
              const document = parseHtml(html)
              // linkedom's getElementsByTagName does not take the "*"
              // wildcard: it answers zero, which would disable this cap.
              if (document.querySelectorAll("*").length > MAX_ELEMENTS) {
                return false
              }

              return isProbablyReaderable(document as never, {
                minContentLength: MIN_CONTENT_LENGTH,
                minScore: MIN_SCORE,
              })
            },
            catch: (cause) =>
              new ReadableContentExtractorError({
                operation: "isReadable",
                url,
                cause,
              }),
          })
        }),

        /**
         * The parse. Takes its own fresh document, because Readability mutates
         * the tree it is given and the gate has already walked the other one.
         */
        extract: Effect.fn("ReadableContentExtractor.extract")(function* (
          html: string,
          url: string,
        ) {
          yield* Effect.annotateCurrentSpan("url", url)
          return yield* Effect.try({
            try: () => {
              const document = withBaseUrl(parseHtml(html), url)
              const article = new Readability(document as never, {
                charThreshold: CHAR_THRESHOLD,
                maxElemsToParse: MAX_ELEMENTS,
                keepClasses: false,
              }).parse()

              const articleHtml = article?.content
              if (!articleHtml || articleHtml.trim().length === 0) {
                return Option.none<ExtractedArticle>()
              }

              if (articleHtml.length > READABLE_HTML_MAX_CHARS) {
                return Option.none<ExtractedArticle>()
              }

              if ((article?.textContent?.trim().length ?? 0) < CHAR_THRESHOLD) {
                return Option.none<ExtractedArticle>()
              }

              const markdown = turndown.turndown(articleHtml).trim()
              if (
                markdown.length === 0 ||
                markdown.length > READABLE_MARKDOWN_MAX_CHARS
              ) {
                return Option.none<ExtractedArticle>()
              }

              const title = nonBlank(article?.title)

              return Option.some<ExtractedArticle>({
                html: articleHtml,
                markdown,
                ...(title ? { title } : {}),
              })
            },
            catch: (cause) =>
              new ReadableContentExtractorError({
                operation: "extract",
                url,
                cause,
              }),
          })
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(
    ReadableContentExtractor,
    ReadableContentExtractor.make,
  )
}
