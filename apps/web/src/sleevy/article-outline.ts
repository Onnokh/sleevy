/// The Article Outline: the sections of a Saved Item's Readable Content, in
/// reading order, with enough of each to recognise it by.
///
/// Read out of the Markdown, not out of the rendered article, and with no DOM
/// anywhere in this file. Both clients render the same stored Markdown, so an
/// outline taken from the source is the same outline on both — the rail the
/// Web Companion draws is the rail the iOS app draws, from one rule rather
/// than two that have to be kept in step. Scraped off the rendered page
/// instead, every line of this would have been web-only work.

/// One section of an article.
export type OutlineEntry = {
  /// Unique within the article, and the id its heading carries in the
  /// document, so the outline can send the reader to it by name.
  readonly id: string
  /// The heading as plain words. Inline markup is resolved rather than shown:
  /// a heading written `## [Microfilm](https://…)` is "Microfilm" here, and
  /// "Microfilm" in the rail.
  readonly title: string
  /// The 1-based line the heading sits on in the Markdown.
  ///
  /// This is the key back to the rendered heading. A renderer that reports
  /// source positions — react-markdown does, and so does swift-markdown — can
  /// ask which entry a heading it is drawing belongs to, instead of slugging
  /// the words a second time and hoping the two passes agree. Two slug passes
  /// that must agree are two passes that one day will not, over a duplicate
  /// heading or an accent, and the rail would then point at nothing.
  readonly line: number
  /// The opening of the section, for the card shown beside its mark. Empty
  /// when the heading is followed straight away by the next one.
  readonly excerpt: string
}

export type ArticleOutline = readonly OutlineEntry[]

/// A rail needs marks to be a rail. Two headings are a pair of links and one
/// is noise, so a level has to carry at least this many before it counts as
/// the outline of the article.
const MIN_ENTRIES = 3

/// The card holds about three lines, so the excerpt is cut near there rather
/// than carrying a whole paragraph nobody will see.
const EXCERPT_MAX_CHARS = 160

/// An ATX heading, flush left, with the closing hashes some writers add.
///
/// Flush left on purpose. Readable Content is written by one converter with
/// `headingStyle: "atx"`, so every heading of the article itself starts at
/// column zero; a `#` that is indented, quoted, or inside a list item is the
/// page quoting something rather than opening a section.
const ATX_HEADING = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/

/// The start or the end of a fenced code block.
const FENCE = /^(`{3,}|~{3,})/

/// A line that is punctuation rather than prose: a horizontal rule, or the
/// dashes under a table's header row.
const RULE_OR_DIVIDER = /^\s*(?:(?:[-*_]\s*){3,}|\|[\s|:-]*\|)\s*$/

/// What opens a line without being part of the sentence on it.
const LEADING_MARKUP = /^\s*(?:>+\s*)*(?:[-*+]|\d+[.)])?\s*/

/// Markdown down to the words it renders as.
const plainText = (markdown: string): string =>
  markdown
    // An image, down to its alt text; a link, down to the words it is on.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/`+([^`]*)`+/g, "$1")
    .replace(/(\*\*|__|~~|\*|_)/g, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()

/// An id from a heading, keeping letters and digits in any script so a Dutch
/// or Japanese heading still reads as itself in the address.
const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")

type HeadingLine = {
  readonly level: number
  readonly line: number
  readonly title: string
}

type Scan = {
  readonly lines: readonly string[]
  /// Which lines sit inside a fenced code block. A `#` in a shell snippet is a
  /// comment and a `## ` in one is a Markdown example, and both were sections
  /// of the article before this was tracked.
  readonly fenced: readonly boolean[]
  readonly headings: readonly HeadingLine[]
}

const scan = (markdown: string): Scan => {
  const lines = markdown.split("\n")
  const fenced: boolean[] = new Array<boolean>(lines.length).fill(false)
  const headings: HeadingLine[] = []
  let fence: string | undefined

  lines.forEach((raw, index) => {
    const opener = FENCE.exec(raw)?.[1]

    if (fence !== undefined) {
      fenced[index] = true
      // A closing fence is the same character, and at least as long.
      if (opener !== undefined && opener.startsWith(fence[0] ?? "") && opener.length >= fence.length) {
        fence = undefined
      }
      return
    }

    if (opener !== undefined) {
      fence = opener
      fenced[index] = true
      return
    }

    const heading = ATX_HEADING.exec(raw)
    if (!heading) return

    const title = plainText(heading[2] ?? "")
    // A heading whose whole content was an image or a permalink affordance
    // leaves nothing to label a mark with.
    if (title.length === 0) return

    headings.push({ level: (heading[1] ?? "").length, line: index + 1, title })
  })

  return { lines, fenced, headings }
}

/// The opening of the section a heading starts, or an empty string when the
/// next heading follows it immediately.
const excerptAfter = (
  lines: readonly string[],
  fenced: readonly boolean[],
  headingLine: number,
): string => {
  for (let index = headingLine; index < lines.length; index += 1) {
    const raw = lines[index] ?? ""
    if (fenced[index]) continue
    // The next section has started, so this one opens with nothing to quote.
    if (ATX_HEADING.test(raw)) break
    if (RULE_OR_DIVIDER.test(raw)) continue

    const text = plainText(raw.replace(LEADING_MARKUP, ""))
    if (text.length === 0) continue

    if (text.length <= EXCERPT_MAX_CHARS) return text
    // Cut on a word, not mid-syllable.
    return `${text.slice(0, EXCERPT_MAX_CHARS).replace(/\s+\S*$/, "")}…`
  }

  return ""
}

/// The Article Outline of one Readable Content, or an empty outline when the
/// article has no level that carries enough headings to be one.
export function articleOutline(markdown: string): ArticleOutline {
  const { lines, fenced, headings } = scan(markdown)

  const counts = new Map<number, number>()
  for (const heading of headings) {
    counts.set(heading.level, (counts.get(heading.level) ?? 0) + 1)
  }

  // The shallowest level that carries enough headings — not simply the
  // shallowest. An article whose only h1 is its own title, with its real
  // sections under h2, would otherwise offer an outline of one mark and lose
  // the outline it actually has. Over the stored corpus this rule finds an
  // outline for 68 of 80 articles where the plain rule finds 60.
  const level = [...counts.entries()]
    .filter(([, count]) => count >= MIN_ENTRIES)
    .map(([candidate]) => candidate)
    .sort((a, b) => a - b)[0]

  if (level === undefined) return []

  const used = new Map<string, number>()

  return headings
    .filter((heading) => heading.level === level)
    .map((heading) => {
      // A heading of pure punctuation slugs to nothing, and two sections of an
      // article are allowed to share a name — "Notes" twice is ordinary.
      const base = slug(heading.title) || "section"
      const seen = (used.get(base) ?? 0) + 1
      used.set(base, seen)

      return {
        id: seen === 1 ? base : `${base}-${seen}`,
        title: heading.title,
        line: heading.line,
        excerpt: excerptAfter(lines, fenced, heading.line),
      }
    })
}
