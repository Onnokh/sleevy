import { Readability, isProbablyReaderable } from "@mozilla/readability"
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

  // An anchor into the original page's own table of contents. It cannot resolve
  // in a Reader View, so the words stay and the link does not.
  turndown.addRule("inPageAnchor", {
    filter: (node) => isInPageAnchor(node) && !isInsideHeading(node),
    replacement: (content) => content,
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
