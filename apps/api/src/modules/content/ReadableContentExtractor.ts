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
  readonly childNodes?: ArrayLike<TurndownNode>
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

/**
 * Elements a page draws one line of code with. Sites that do not put newlines
 * in a `pre` put a line in each of these instead.
 */
const CODE_LINE = new Set(["DIV", "P", "BR"])

/**
 * The text of a block of code, with the line breaks the page wrote as markup.
 * A `pre` that draws every line as its own `div` carries no newline in its
 * text at all, and its whole listing came out on one line.
 */
const codeText = (node: TurndownNode): string => {
  const children = Array.from(node.childNodes ?? [])
  if (children.length === 0) return node.textContent ?? ""

  let text = ""
  for (const child of children) {
    if (child.nodeName === "BR") {
      text += "\n"
      continue
    }

    if (!CODE_LINE.has(child.nodeName)) {
      text += codeText(child)
      continue
    }

    // A line of its own, on both sides: MDN writes a formal syntax block as a
    // `pre` of `p` elements, and a line break only after each one ran the end
    // of one definition into the start of the next.
    if (text.length > 0 && !text.endsWith("\n")) text += "\n"
    text += codeText(child)
    if (!text.endsWith("\n")) text += "\n"
  }

  return text
}

/**
 * The fence to wrap a block of code in: one backtick longer than the longest
 * run of them the code opens a line with, which is what Markdown asks for.
 *
 * An article about Markdown quotes fenced blocks, and a three-backtick fence
 * around code whose own first line is three backticks ends the block on that
 * line: the rest of the code left the block and was read as prose.
 */
const fenceFor = (text: string): string => {
  const runs = (text.match(/^`+/gm) ?? []).map((run) => run.length)
  return "`".repeat(Math.max(3, ...runs.map((run) => run + 1)))
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

  // A block of code, however the page marked it up. Turndown fences a `pre`
  // only when a `code` element is inside it, and half the code in the stored
  // corpus is not written that way: 185 blocks across seven hosts — GitHub,
  // MDN, gists — put the code straight in the `pre`, or wrap each token in a
  // styling span. Those blocks were not fenced at all. They reached the reader
  // as prose, with the escaping and the paragraph breaks prose gets: a shell
  // comment on a line of its own ("# or") became a Markdown heading, an
  // assignment became "x \= 1", and a `pre` of `div` lines became one
  // paragraph per line.
  //
  // The language is read off the attributes rather than the class. Readability
  // runs first with keepClasses off and strips the classes, so in the stored
  // corpus no article kept one — the data attributes did, on six. Keeping the
  // classes was measured at +19% article HTML for no language recovered.
  turndown.addRule("fencedCode", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      // The `code` element where there is one, and the `pre` itself where the
      // page never wrote one. Either way the code is its text, never the
      // converted markup: the spans a highlighter leaves behind say how the
      // code is coloured, not what it says.
      const code =
        node.firstChild?.nodeName === "CODE"
          ? (node.firstChild as TurndownNode)
          : (node as TurndownNode)
      const language = languageOf(code) || languageOf(node)
      const text = codeText(code).replace(/\n+$/, "")
      const fence = fenceFor(text)
      return `\n\n${fence}${language}\n${text}\n${fence}\n\n`
    },
  })

  // An anchor with nothing to show for itself: an icon link whose icon is an
  // SVG, or a logo whose image Readability dropped. Turndown answers it with a
  // link that has no text — "[](https://…)" — which draws nothing at all in
  // the Reader View while still taking a line. Three articles carried one.
  turndown.addRule("emptyLink", {
    filter: (node) =>
      node.nodeName === "A" &&
      (node.textContent ?? "").trim().length === 0 &&
      // An anchor around an image is not empty; the image is what it shows.
      !node.querySelector?.("img"),
    replacement: () => "",
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

/**
 * Blocks whose children are written to be read as one run of words. A line the
 * page broke inside one of these is a line break in the prose; a line break
 * between two of them already survives as the blocks themselves.
 */
const JOINED_BLOCK =
  "h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, dd, dt, td, th"

const ELEMENT_NODE = 1

const words = (text: string) => text.trim().split(/\s+/)

/**
 * Whether two elements side by side, with nothing at all between them, are two
 * lines the page laid out with CSS rather than one run of words.
 *
 * `<h2><span>The first browser</span><span>for machines, not humans</span></h2>`
 * is two lines on the page and "The first browserfor machines, not humans"
 * everywhere the Markdown is read. The page breaks the line by making each
 * span a block, and the stylesheet is not here to say so.
 *
 * The evidence that is here is the words themselves. Two phrases meeting at a
 * word boundary were never one word, so the page put them on two lines:
 * "browser" then "for", "scrolling." then "Physical". A word split by markup
 * looks nothing like that — one side is a letter, or a bracket, or a fragment
 * — and it keeps the join it was written with.
 */
const isBrokenLine = (left: string, right: string): boolean => {
  // Nothing between them, or the page already wrote the space.
  if (left.length === 0 || right.length === 0) return false
  if (/\s$/.test(left) || /^\s/.test(right)) return false

  // A phrase either side. A single word marked up on its own is a word being
  // styled, not a line: a heading of one span per letter is a reveal
  // animation, and spacing it gives "B u i l t".
  if (!left.trim().includes(" ") || !right.trim().includes(" ")) return false

  // And a whole word either side of the join. `…Applied to C</strong><a>omplex
  // Applications…` is one word cut in half by a link, and a space there cuts
  // the word in half in the prose as well.
  const before = words(left).at(-1) ?? ""
  const after = words(right)[0] ?? ""
  if (before.length < 2 || after.length < 2) return false

  // A line ends on a word or on the punctuation after it, and the next line
  // opens on a word. A right side opening on "," or ":" continues the left.
  return /[\p{L}\p{N}.?!)"'\u2019\u201d]$/u.test(left) && /^[\p{L}\p{N}]/u.test(right)
}

/**
 * Put back the spaces a page left to its stylesheet, so a heading broken
 * across two lines reads as the one sentence it is.
 *
 * Repairing the HTML rather than the Markdown, because the HTML is what is
 * missing the space: every conversion rule then keeps working on the shape it
 * was written for, and the link, the emphasis and the heading either side of
 * the join are converted exactly as before.
 */
const joinBrokenLines = (html: string): string => {
  // Article HTML is a fragment, and linkedom gives a fragment no body to read
  // it back out of — serialising the document it parses one into writes an
  // empty `head` and `body` inside the first element. A container the fragment
  // is put into and taken back out of has no such edge.
  const document = parseHtml("<div></div>")
  const root = document.querySelector("div")
  if (!root) return html
  root.innerHTML = html

  for (const block of root.querySelectorAll(JOINED_BLOCK)) {
    // Code says what it says. Whitespace inside it is the code's own.
    if (block.closest("pre, code")) continue

    for (const child of [...block.childNodes]) {
      const next = child.nextSibling
      if (!next) continue
      if (child.nodeType !== ELEMENT_NODE || next.nodeType !== ELEMENT_NODE) continue
      if (!isBrokenLine(child.textContent ?? "", next.textContent ?? "")) continue

      block.insertBefore(document.createTextNode(" "), next)
    }
  }

  return root.innerHTML
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

      /**
       * Article HTML to Markdown, by the one road. Both the parse and the
       * re-conversion arrive here, so neither can be given a repair the other
       * does not get.
       */
      const toMarkdown = (html: string) =>
        turndown.turndown(joinBrokenLines(html)).trim()

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
            try: () => toMarkdown(html),
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

              const markdown = toMarkdown(articleHtml)
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
