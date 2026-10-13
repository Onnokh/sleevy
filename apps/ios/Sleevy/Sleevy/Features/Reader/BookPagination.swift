import SwiftUI
import UIKit

/// An article set as a book: the Readable Content laid out across pages of
/// one fixed size, as the iPhone Duo's Reader View turns them.
///
/// TextKit 1 does the work. One layout manager owns the text, and every page
/// is one more text container in its chain, so a paragraph that does not fit
/// on one page runs on to the next one exactly where it stopped. Each page
/// then draws only its own container's glyphs.
@MainActor
final class BookPagination {
    struct Key: Hashable {
        let articleID: SavedItem.ID
        let pageSize: CGSize
        let bodySize: CGFloat

        func hash(into hasher: inout Hasher) {
            hasher.combine(articleID)
            hasher.combine(pageSize.width)
            hasher.combine(pageSize.height)
            hasher.combine(bodySize)
        }
    }

    let key: Key
    let layoutManager = NSLayoutManager()
    private let storage: NSTextStorage
    private(set) var containers: [NSTextContainer] = []
    /// The page each outline entry's heading is on, by entry id.
    private(set) var entryPages: [String: Int] = [:]

    /// A sanity cap, far past any article: a page of one word is still a
    /// page, and a layout that never ends should not take the app with it.
    private static let maximumPages = 2000

    init(key: Key, article: ReaderView.Article, title: String, byline: String) {
        self.key = key
        let built = BookText.build(
            sections: article.sections,
            title: title,
            byline: byline,
            bodySize: key.bodySize
        )
        storage = NSTextStorage(attributedString: built.text)
        storage.addLayoutManager(layoutManager)
        layoutManager.allowsNonContiguousLayout = false
        paginate()

        for (entryID, location) in built.entryLocations where location < storage.length {
            entryPages[entryID] = page(containingCharacter: location)
        }
    }

    var pageCount: Int { containers.count }

    func glyphRange(page: Int) -> NSRange {
        guard containers.indices.contains(page) else { return NSRange(location: 0, length: 0) }
        return layoutManager.glyphRange(for: containers[page])
    }

    /// The page a character of the text is set on.
    func page(containingCharacter location: Int) -> Int {
        guard location < storage.length else { return max(0, pageCount - 1) }
        let glyph = layoutManager.glyphIndexForCharacter(at: max(0, location))
        guard let container = layoutManager.textContainer(forGlyphAt: glyph, effectiveRange: nil) else { return 0 }
        return containers.firstIndex { $0 === container } ?? 0
    }

    /// Where a page starts in the text.
    func firstCharacter(page: Int) -> Int {
        let range = glyphRange(page: page)
        guard range.length > 0 else { return 0 }
        return layoutManager.characterIndexForGlyph(at: range.location)
    }

    /// A page's words, for VoiceOver.
    func text(page: Int) -> String {
        let characters = layoutManager.characterRange(forGlyphRange: glyphRange(page: page), actualGlyphRange: nil)
        return (storage.string as NSString).substring(with: characters)
    }

    /// Adds pages until the text runs out. A heading that would end a page,
    /// with its section starting on the next one, is moved over to that page:
    /// the rest of its page is excluded from the layout, and the text flows
    /// on without it.
    private func paginate() {
        var index = 0
        while index < Self.maximumPages {
            if index == containers.count {
                let container = NSTextContainer(size: key.pageSize)
                container.lineFragmentPadding = 0
                layoutManager.addTextContainer(container)
                containers.append(container)
            }

            let container = containers[index]
            let range = layoutManager.glyphRange(for: container)
            if range.length == 0 {
                if index > 0 {
                    layoutManager.removeTextContainer(at: index)
                    containers.removeLast()
                }
                break
            }

            let isLastPage = NSMaxRange(range) >= layoutManager.numberOfGlyphs
            if !isLastPage, container.exclusionPaths.isEmpty, let cut = strandedHeadingTop(in: range) {
                container.exclusionPaths = [UIBezierPath(rect: CGRect(
                    x: 0,
                    y: cut,
                    width: key.pageSize.width,
                    height: key.pageSize.height - cut
                ))]
                continue
            }

            if isLastPage { break }
            index += 1
        }
    }

    /// Where a heading stranded at the foot of a page starts, or nil when the
    /// page ends in prose.
    private func strandedHeadingTop(in range: NSRange) -> CGFloat? {
        var lines: [(rect: CGRect, glyphs: NSRange)] = []
        layoutManager.enumerateLineFragments(forGlyphRange: range) { rect, _, _, glyphs, _ in
            lines.append((rect, glyphs))
        }

        var first = lines.count
        while first > 0, isHeading(lines[first - 1].glyphs) {
            first -= 1
        }

        // The page has to keep something: a heading alone on a page stays.
        guard first < lines.count, first > 0 else { return nil }
        return lines[first].rect.minY
    }

    private func isHeading(_ glyphs: NSRange) -> Bool {
        let character = layoutManager.characterIndexForGlyph(at: glyphs.location)
        guard character < storage.length else { return false }
        return storage.attribute(.bookHeading, at: character, effectiveRange: nil) != nil
    }
}

extension NSAttributedString.Key {
    /// Marks the characters of a section heading, so pagination can keep a
    /// heading with the text under it.
    static let bookHeading = NSAttributedString.Key("app.sleevy.bookHeading")
}

/// The article's Markdown as one attributed string, styled as book pages:
/// justified, hyphenated prose with indented paragraphs, and headings that
/// open a little space above them.
enum BookText {
    struct Built {
        let text: NSAttributedString
        /// Where each outline entry's section starts in the text.
        let entryLocations: [String: Int]
    }

    static func build(sections: [ArticleSection], title: String, byline: String, bodySize: CGFloat) -> Built {
        let result = NSMutableAttributedString()
        var locations: [String: Int] = [:]

        // The front matter, as the first page of a chapter: where the save is
        // from, then its title.
        let bylineStyle = NSMutableParagraphStyle()
        bylineStyle.paragraphSpacing = bodySize * 0.5
        result.append(NSAttributedString(string: byline + "\n", attributes: [
            .font: UIFont.systemFont(ofSize: bodySize * 0.88),
            .foregroundColor: UIColor.secondaryLabel,
            .paragraphStyle: bylineStyle,
        ]))

        let titleStyle = NSMutableParagraphStyle()
        titleStyle.paragraphSpacing = bodySize * 1.4
        titleStyle.lineHeightMultiple = 0.98
        result.append(NSAttributedString(string: title + "\n", attributes: [
            .font: UIFont.systemFont(ofSize: bodySize * 1.9, weight: .heavy),
            .foregroundColor: UIColor.label,
            .kern: -0.4,
            .paragraphStyle: titleStyle,
        ]))

        let fonts = Fonts(bodySize: bodySize)
        for section in sections {
            if let entryID = section.entryID {
                locations[entryID] = result.length
            }
            append(markdown: section.markdown, to: result, fonts: fonts)
        }

        // No paragraph break after the last line, or the layout would set an
        // empty line that can spill onto a page of its own.
        if result.string.hasSuffix("\n") {
            result.deleteCharacters(in: NSRange(location: result.length - 1, length: 1))
        }

        return Built(text: result, entryLocations: locations)
    }

    private struct Fonts {
        let bodySize: CGFloat

        var body: UIFont { .systemFont(ofSize: bodySize) }
        var heading: UIFont { .systemFont(ofSize: bodySize * 1.12, weight: .bold) }

        func inline(_ intent: InlinePresentationIntent?, base: UIFont) -> UIFont {
            guard let intent else { return base }
            if intent.contains(.code) {
                return .monospacedSystemFont(ofSize: base.pointSize * 0.88, weight: .regular)
            }
            var traits = base.fontDescriptor.symbolicTraits
            if intent.contains(.stronglyEmphasized) { traits.insert(.traitBold) }
            if intent.contains(.emphasized) { traits.insert(.traitItalic) }
            guard let descriptor = base.fontDescriptor.withSymbolicTraits(traits) else { return base }
            return UIFont(descriptor: descriptor, size: base.pointSize)
        }
    }

    private enum Block: Equatable {
        case paragraph
        case heading
        case listItem(marker: String)
        case quote
        case code

        init(_ intent: PresentationIntent?) {
            guard let intent else {
                self = .paragraph
                return
            }
            var ordered = false
            var ordinal: Int?
            var kind: Block = .paragraph
            for component in intent.components {
                switch component.kind {
                case .header:
                    kind = .heading
                case .codeBlock:
                    kind = .code
                case .blockQuote where kind == .paragraph:
                    kind = .quote
                case .listItem(let number):
                    ordinal = number
                case .orderedList:
                    ordered = true
                default:
                    break
                }
            }
            if kind == .paragraph, let ordinal {
                self = .listItem(marker: ordered ? "\(ordinal)." : "•")
            } else {
                self = kind
            }
        }
    }

    /// The body text colour: the label colour at three quarters, so a page
    /// of prose is not a wall of white and the headings stand out of it.
    static let ink = UIColor { traits in
        UIColor.label.resolvedColor(with: traits).withAlphaComponent(0.74)
    }

    private static func append(markdown: String, to result: NSMutableAttributedString, fonts: Fonts) {
        let options = AttributedString.MarkdownParsingOptions(
            interpretedSyntax: .full,
            failurePolicy: .returnPartiallyParsedIfPossible
        )
        let parsed = (try? AttributedString(markdown: markdown, options: options)) ?? AttributedString(markdown)

        var lastIntent: PresentationIntent??
        var previousBlock: Block?
        var block = Block.paragraph

        for run in parsed.runs {
            // An image has no text worth setting; its alt text is not prose.
            if run.imageURL != nil { continue }

            let intent = run.presentationIntent
            if lastIntent == nil || lastIntent! != intent {
                if lastIntent != nil {
                    result.append(NSAttributedString(string: "\n"))
                    previousBlock = block
                }
                block = Block(intent)
                lastIntent = intent

                if case .listItem(let marker) = block {
                    result.append(NSAttributedString(
                        string: marker + "\t",
                        attributes: attributes(for: block, after: previousBlock, font: fonts.body, fonts: fonts)
                    ))
                }
            }

            let base = block == .heading ? fonts.heading : fonts.body
            let font = fonts.inline(run.inlinePresentationIntent, base: base)
            var text = String(parsed[run.range].characters)
            if block == .code { text = text.trimmingCharacters(in: .newlines) }
            result.append(NSAttributedString(
                string: text,
                attributes: attributes(for: block, after: previousBlock, font: font, fonts: fonts)
            ))
        }

        result.append(NSAttributedString(string: "\n"))
    }

    private static func attributes(
        for block: Block,
        after previous: Block?,
        font: UIFont,
        fonts: Fonts
    ) -> [NSAttributedString.Key: Any] {
        let size = fonts.bodySize
        let style = NSMutableParagraphStyle()
        // Lines about 1.6 times the type size apart: the leading of a book
        // page.
        style.lineHeightMultiple = 1.34
        var attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: ink]

        switch block {
        case .paragraph:
            style.alignment = .justified
            style.hyphenationFactor = 1
            // A book indents a paragraph that follows another one, and
            // starts flush after a heading, a list or a quote, with a little
            // space after the last two.
            style.firstLineHeadIndent = previous == .paragraph ? size * 1.4 : 0
            if let previous, previous != .paragraph, previous != .heading {
                style.paragraphSpacingBefore = size * 0.6
            }
        case .heading:
            // One blank line above a heading, and none under it: the heading
            // belongs to the text it opens.
            style.paragraphSpacingBefore = size * 1.5
            style.paragraphSpacing = size * 0.15
            style.lineHeightMultiple = 1.15
            attributes[.foregroundColor] = UIColor.label
            attributes[.bookHeading] = true
        case .listItem:
            let indent = size * 1.4
            style.headIndent = indent
            style.tabStops = [NSTextTab(textAlignment: .left, location: indent)]
            style.defaultTabInterval = indent
            style.hyphenationFactor = 1
            if case .listItem = previous {} else { style.paragraphSpacingBefore = size * 0.6 }
        case .quote:
            style.headIndent = size * 1.3
            style.firstLineHeadIndent = size * 1.3
            style.paragraphSpacingBefore = size * 0.6
            style.hyphenationFactor = 1
            attributes[.foregroundColor] = UIColor.secondaryLabel
            if let descriptor = font.fontDescriptor.withSymbolicTraits(.traitItalic) {
                attributes[.font] = UIFont(descriptor: descriptor, size: font.pointSize)
            }
        case .code:
            style.paragraphSpacingBefore = size * 0.6
            style.lineHeightMultiple = 1.1
            attributes[.foregroundColor] = UIColor.secondaryLabel
        }

        attributes[.paragraphStyle] = style
        return attributes
    }
}

/// One page of a ``BookPagination``: the glyphs of its text container, drawn
/// as they were laid out.
struct BookPageText: UIViewRepresentable {
    let pagination: BookPagination
    let page: Int

    func makeUIView(context: Context) -> BookPageTextView {
        let view = BookPageTextView()
        view.isOpaque = false
        view.backgroundColor = .clear
        view.contentMode = .redraw
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ view: BookPageTextView, context: Context) {
        guard view.pagination !== pagination || view.page != page else { return }
        view.pagination = pagination
        view.page = page
        view.setNeedsDisplay()
    }
}

final class BookPageTextView: UIView {
    var pagination: BookPagination?
    var page = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (view: BookPageTextView, _) in
            view.setNeedsDisplay()
        }
    }

    required init?(coder: NSCoder) {
        fatalError("BookPageTextView is created in code, never from a nib.")
    }

    override func draw(_ rect: CGRect) {
        MainActor.assumeIsolated {
            guard let pagination else { return }
            let range = pagination.glyphRange(page: page)
            guard range.length > 0 else { return }
            pagination.layoutManager.drawBackground(forGlyphRange: range, at: .zero)
            pagination.layoutManager.drawGlyphs(forGlyphRange: range, at: .zero)
        }
    }
}
