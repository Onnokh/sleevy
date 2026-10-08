import Foundation

/// The Article Outline: the sections of a Saved Item's Readable Content, in
/// reading order, with enough of each to recognise it by.
///
/// Read out of the Markdown, not out of the rendered article. Both clients
/// render the same stored Markdown, so an outline taken from the source is the
/// same outline on both — the rail the Web Companion draws is the rail the iOS
/// app draws, from one rule rather than two that have to be kept in step.
///
/// This is a port of `apps/web/src/sleevy/article-outline.ts`, kept line for
/// line with it on purpose. The web tests were written as the contract for
/// this file; `ArticleOutlineTests` is the same suite in Swift, so the two
/// implementations answer the same questions with the same answers.

/// One section of an article.
nonisolated struct OutlineEntry: Equatable, Identifiable, Sendable {
    /// Unique within the article, and the id its heading carries in the
    /// document, so the outline can send the reader to it by name.
    let id: String
    /// The heading as plain words. Inline markup is resolved rather than shown:
    /// a heading written `## [Microfilm](https://…)` is "Microfilm" here, and
    /// "Microfilm" in the rail.
    let title: String
    /// The 1-based line the heading sits on in the Markdown.
    ///
    /// This is the key back to the rendered heading. The Web Companion's
    /// renderer reports source positions and matches on this; MarkdownUI does
    /// not, so here the line is where the article is cut into sections
    /// instead — see ``articleSections(markdown:outline:)``. Either way the
    /// link back to the rendered heading is the line it is really on, not a
    /// second slug pass that has to agree with the first.
    let line: Int
    /// The opening of the section, for the card shown beside its mark. Empty
    /// when the heading is followed straight away by the next one.
    let excerpt: String
}

typealias ArticleOutline = [OutlineEntry]

/// A rail needs marks to be a rail. Two headings are a pair of links and one
/// is noise, so a level has to carry at least this many before it counts as
/// the outline of the article.
private let minimumEntries = 3

/// The card holds about three lines, so the excerpt is cut near there rather
/// than carrying a whole paragraph nobody will see.
private let excerptMaxCharacters = 160

private enum OutlinePattern {
    /// An ATX heading, flush left, with the closing hashes some writers add.
    ///
    /// Flush left on purpose. Readable Content is written by one converter with
    /// `headingStyle: "atx"`, so every heading of the article itself starts at
    /// column zero; a `#` that is indented, quoted, or inside a list item is the
    /// page quoting something rather than opening a section.
    static let atxHeading = try! Regex(#"^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$"#)

    /// The start or the end of a fenced code block.
    static let fence = try! Regex(#"^(`{3,}|~{3,})"#)

    /// A line that is punctuation rather than prose: a horizontal rule, or the
    /// dashes under a table's header row.
    static let ruleOrDivider = try! Regex(#"^\s*(?:(?:[-*_]\s*){3,}|\|[\s|:-]*\|)\s*$"#)

    /// What opens a line without being part of the sentence on it.
    static let leadingMarkup = try! Regex(#"^\s*(?:>+\s*)*(?:[-*+]|\d+[.)])?\s*"#)

    static let image = try! Regex(#"!\[([^\]]*)\]\([^)]*\)"#)
    static let inlineLink = try! Regex(#"\[([^\]]*)\]\([^)]*\)"#)
    static let referenceLink = try! Regex(#"\[([^\]]*)\]\[[^\]]*\]"#)
    static let codeSpan = try! Regex(#"`+([^`]*)`+"#)
    static let emphasis = try! Regex(#"(\*\*|__|~~|\*|_)"#)
    static let escaped = try! Regex(#"\\([\\`*_{}\[\]()#+\-.!])"#)
    static let whitespaceRun = try! Regex(#"\s+"#)
    static let nonAlphanumericRun = try! Regex(#"[^\p{L}\p{N}]+"#)
    static let trailingWord = try! Regex(#"\s+\S*$"#)
}

/// Markdown down to the words it renders as.
private func plainText(_ markdown: String) -> String {
    var text = markdown
    // An image, down to its alt text; a link, down to the words it is on.
    text = text.replacing(OutlinePattern.image) { $0[1].substring ?? "" }
    text = text.replacing(OutlinePattern.inlineLink) { $0[1].substring ?? "" }
    text = text.replacing(OutlinePattern.referenceLink) { $0[1].substring ?? "" }
    text = text.replacing(OutlinePattern.codeSpan) { $0[1].substring ?? "" }
    text = text.replacing(OutlinePattern.emphasis, with: "")
    text = text.replacing(OutlinePattern.escaped) { $0[1].substring ?? "" }
    text = text.replacing(OutlinePattern.whitespaceRun, with: " ")
    return text.trimmingCharacters(in: .whitespacesAndNewlines)
}

/// An id from a heading, keeping letters and digits in any script so a Dutch
/// or Japanese heading still reads as itself in the address.
private func slug(_ title: String) -> String {
    let lowered = title.lowercased().replacing(OutlinePattern.nonAlphanumericRun, with: "-")
    return lowered.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
}

private struct HeadingLine {
    let level: Int
    let line: Int
    let title: String
}

private struct Scan {
    let lines: [String]
    /// Which lines sit inside a fenced code block. A `#` in a shell snippet is
    /// a comment and a `## ` in one is a Markdown example, and both were
    /// sections of the article before this was tracked.
    let fenced: [Bool]
    let headings: [HeadingLine]
}

private func scan(_ markdown: String) -> Scan {
    let lines = markdown.components(separatedBy: "\n")
    var fenced = [Bool](repeating: false, count: lines.count)
    var headings: [HeadingLine] = []
    var fence: String?

    for (index, raw) in lines.enumerated() {
        let opener = raw.firstMatch(of: OutlinePattern.fence).flatMap { $0[1].substring.map(String.init) }

        if let current = fence {
            fenced[index] = true
            // A closing fence is the same character, and at least as long.
            if let opener,
               let marker = current.first,
               opener.hasPrefix(String(marker)),
               opener.count >= current.count {
                fence = nil
            }
            continue
        }

        if let opener {
            fence = opener
            fenced[index] = true
            continue
        }

        guard let heading = raw.firstMatch(of: OutlinePattern.atxHeading) else { continue }

        let title = plainText(heading[2].substring.map(String.init) ?? "")
        // A heading whose whole content was an image or a permalink affordance
        // leaves nothing to label a mark with.
        if title.isEmpty { continue }

        let level = heading[1].substring?.count ?? 0
        headings.append(HeadingLine(level: level, line: index + 1, title: title))
    }

    return Scan(lines: lines, fenced: fenced, headings: headings)
}

/// The opening of the section a heading starts, or an empty string when the
/// next heading follows it immediately.
private func excerptAfter(lines: [String], fenced: [Bool], headingLine: Int) -> String {
    var index = headingLine
    while index < lines.count {
        defer { index += 1 }
        let raw = lines[index]
        if fenced[index] { continue }
        // The next section has started, so this one opens with nothing to quote.
        if raw.firstMatch(of: OutlinePattern.atxHeading) != nil { break }
        if raw.firstMatch(of: OutlinePattern.ruleOrDivider) != nil { continue }

        let stripped = raw.replacing(OutlinePattern.leadingMarkup, with: "", maxReplacements: 1)
        let text = plainText(stripped)
        if text.isEmpty { continue }

        if text.count <= excerptMaxCharacters { return text }
        // Cut on a word, not mid-syllable.
        let cut = String(text.prefix(excerptMaxCharacters))
        return cut.replacing(OutlinePattern.trailingWord, with: "") + "…"
    }

    return ""
}

/// The Article Outline of one Readable Content, or an empty outline when the
/// article has no level that carries enough headings to be one.
nonisolated func articleOutline(_ markdown: String) -> ArticleOutline {
    let scanned = scan(markdown)

    var counts: [Int: Int] = [:]
    for heading in scanned.headings {
        counts[heading.level, default: 0] += 1
    }

    // The shallowest level that carries enough headings — not simply the
    // shallowest. An article whose only h1 is its own title, with its real
    // sections under h2, would otherwise offer an outline of one mark and lose
    // the outline it actually has.
    guard let level = counts
        .filter({ $0.value >= minimumEntries })
        .keys
        .min()
    else { return [] }

    var used: [String: Int] = [:]

    return scanned.headings
        .filter { $0.level == level }
        .map { heading in
            // A heading of pure punctuation slugs to nothing, and two sections
            // of an article are allowed to share a name — "Notes" twice is
            // ordinary.
            let base = slug(heading.title).isEmpty ? "section" : slug(heading.title)
            let seen = (used[base] ?? 0) + 1
            used[base] = seen

            return OutlineEntry(
                id: seen == 1 ? base : "\(base)-\(seen)",
                title: heading.title,
                line: heading.line,
                excerpt: excerptAfter(lines: scanned.lines, fenced: scanned.fenced, headingLine: heading.line)
            )
        }
}

// MARK: - Sections

/// One run of the article: the prologue, or the section one outline entry
/// opens.
nonisolated struct ArticleSection: Identifiable, Equatable, Sendable {
    /// The outline entry this section belongs to, or `nil` for the prologue —
    /// the title, the byline and whatever prose runs before the first heading.
    let entryID: String?
    let markdown: String

    var id: String { entryID ?? "" }
}

/// The article cut at its outline's headings, so each section can be scrolled
/// to by name.
///
/// The Web Companion has no need for this: react-markdown reports the source
/// position of every heading it draws, so the rail can put an id on the real
/// heading element and let the browser scroll to it. MarkdownUI reports
/// nothing of the kind, so the article is cut at the lines the outline already
/// knows and each piece rendered under its own id. Same outline, same
/// destinations, one renderer difference absorbed here rather than in the rail.
nonisolated func articleSections(markdown: String, outline: ArticleOutline) -> [ArticleSection] {
    guard !outline.isEmpty else {
        return [ArticleSection(entryID: nil, markdown: markdown)]
    }

    let lines = markdown.components(separatedBy: "\n")
    var sections: [ArticleSection] = []

    // Everything above the first heading belongs to no section.
    let firstLine = outline[0].line - 1
    if firstLine > 0 {
        let prologue = lines[0..<min(firstLine, lines.count)].joined(separator: "\n")
        if !prologue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            sections.append(ArticleSection(entryID: nil, markdown: prologue))
        }
    }

    for (index, entry) in outline.enumerated() {
        let start = min(entry.line - 1, lines.count)
        let end = index + 1 < outline.count ? min(outline[index + 1].line - 1, lines.count) : lines.count
        guard start < end else { continue }
        sections.append(
            ArticleSection(entryID: entry.id, markdown: lines[start..<end].joined(separator: "\n"))
        )
    }

    return sections
}

// MARK: - Reading position

/// How far down the reading pane a heading travels before the section it opens
/// becomes the one being read. A section is claimed as its heading reaches the
/// top of the pane rather than as it leaves the pane: waiting for it to leave
/// keeps the *previous* section marked for the whole first screen of the new
/// one, which the reader sees as the rail lagging a section behind them.
let readingLine: CGFloat = 96

/// Which entry of an Article Outline is being read, from where the headings
/// sit and where the pane has been scrolled to.
///
/// Pure, and written in four numbers every platform already has. The obvious
/// implementation on the web is an IntersectionObserver, and SwiftUI has no
/// such thing — a rule written against one would not have survived the
/// crossing, while this one is the same arithmetic against a scroll offset
/// wherever it is rebuilt.
///
/// The opening of an article — its title, its byline, the paragraphs before
/// the first heading — belongs to no section, and the rail marks the first one
/// there anyway. A rail that starts with nothing lit reads as not yet working,
/// and the reader is on their way into that first section rather than anywhere
/// else. Only an empty outline has no answer, and an empty outline draws no
/// rail to answer for.
nonisolated func activeOutlineIndex(
    tops: [CGFloat],
    scrollTop: CGFloat,
    viewportHeight: CGFloat,
    contentHeight: CGFloat
) -> Int {
    if tops.isEmpty { return -1 }

    // The last section of an article is usually shorter than the reading line
    // is deep, so its heading never travels far enough to claim its mark and
    // the rail stops one short however far the reader scrolls. Reaching the
    // end of the article is reaching its last section, whatever the arithmetic
    // says.
    if contentHeight - viewportHeight - scrollTop <= 1 { return tops.count - 1 }

    var active = 0
    for (index, top) in tops.enumerated() where top - scrollTop <= readingLine {
        active = index
    }

    return active
}
