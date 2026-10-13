import SwiftUI

/// The Reader View where the device has a vertical bar — the iPhone Duo — set
/// as a book rather than a scroll.
///
/// Wide, the pane is a spread: the text runs from the left page to the right
/// one, split on the hinge, and a swipe turns both. With the Article Outline
/// switched on, the outline takes the left page, like the contents page of a
/// book, and only the right page turns. Narrow — the cover, or the inner
/// display held tall — it is one page at a time, and the outline takes the
/// page's place.
///
/// The scroll wheel in the bar turns to a section's page. The book only
/// reports which section is open; the wheel and its deck belong to the
/// Reader View.
struct BookReader: View {
    let article: ReaderView.Article
    let item: SavedItem
    let bodySize: CGFloat
    /// The pane's size, inside the safe area.
    let paneSize: CGSize
    /// Where the hinge runs, from the pane's leading edge, when the pane is
    /// wide enough for two pages; nil for one page at a time.
    let hinge: CGFloat?
    @Binding var showsOutline: Bool
    /// The section the wheel last pointed at; the book turns to its page.
    let target: String?
    @Binding var activeIndex: Int
    /// The page each section starts on, for the deck beside the wheel.
    @Binding var entryPages: [String: Int]

    /// The first page on screen: the left one of a spread, or the only one.
    @State private var page = 0
    /// Where the open page starts in the text, so a new type size or a new
    /// pane opens the page that has the same words on it.
    @State private var anchor = 0
    @State private var cache = BookPaginationCache()

    /// The white space either side of the text on a page.
    private static let margin: CGFloat = 30
    /// The widest a page's text gets, whatever the page: a book's measure.
    private static let maximumMeasure: CGFloat = 520
    /// The band at the top of a page that holds the running head.
    private static let headHeight: CGFloat = 46
    /// The band at the foot of a page that holds the page number.
    private static let folioHeight: CGFloat = 46

    var body: some View {
        let pagination = pagination

        Group {
            if let hinge {
                if showsOutline {
                    HStack(spacing: 0) {
                        outlinePage(pagination)
                            .frame(width: hinge)
                        pageTurner(pagination, pageWidth: paneSize.width - hinge)
                    }
                } else {
                    spreadTurner(pagination, left: hinge, right: paneSize.width - hinge)
                }
            } else if showsOutline {
                outlinePage(pagination)
            } else {
                pageTurner(pagination, pageWidth: paneSize.width)
            }
        }
        .frame(width: paneSize.width, height: paneSize.height)
        .onChange(of: pagination.key, initial: true) {
            entryPages = pagination.entryPages
            page = pagination.page(containingCharacter: anchor)
        }
        .onChange(of: page) {
            anchor = pagination.firstCharacter(page: page)
            updateActiveIndex(pagination)
        }
        .onChange(of: showsOutline) {
            updateActiveIndex(pagination)
        }
        .onChange(of: target) { _, target in
            guard let target,
                  let index = article.outline.firstIndex(where: { $0.id == target }),
                  let start = pagination.entryPages[target]
            else { return }
            // No animation: the pages keep up with the finger on the wheel.
            activeIndex = index
            page = start
        }
    }

    // MARK: - Pagination

    private var isSpread: Bool {
        hinge != nil && !showsOutline
    }

    /// The text area of every page. Both pages of a spread are set to the
    /// narrower one, so a line is the same length on either side of the fold.
    private var textSize: CGSize {
        let pageWidth = hinge.map { min($0, paneSize.width - $0) } ?? paneSize.width
        let width = min(pageWidth - 2 * Self.margin, Self.maximumMeasure)
        let height = paneSize.height - Self.headHeight - Self.folioHeight
        return CGSize(width: max(width, 160).rounded(.down), height: max(height, 160).rounded(.down))
    }

    private var pagination: BookPagination {
        let key = BookPagination.Key(
            articleID: article.content.savedItemId,
            pageSize: textSize,
            bodySize: bodySize
        )
        return cache.pagination(for: key) { key in
            BookPagination(
                key: key,
                article: article,
                title: article.content.title ?? item.displayTitle,
                byline: "\(item.displayDomain) · \(item.createdDateLabel)"
            )
        }
    }

    /// The pages on screen.
    private var visiblePages: ClosedRange<Int> {
        isSpread ? (page - page % 2)...(page - page % 2 + 1) : page...page
    }

    /// Which section is open. The one already marked stays marked while any
    /// of it is on screen, so the wheel does not jump to a later section that
    /// starts lower on the same spread. Otherwise it is the last section to
    /// start on or before the last page on screen.
    private func updateActiveIndex(_ pagination: BookPagination) {
        let outline = article.outline
        guard !outline.isEmpty else { return }
        let visible = visiblePages

        func start(_ index: Int) -> Int? {
            outline.indices.contains(index) ? pagination.entryPages[outline[index].id] : nil
        }

        if let current = start(activeIndex),
           current <= visible.upperBound,
           (start(activeIndex + 1) ?? .max) >= visible.lowerBound {
            return
        }

        var next = 0
        for index in outline.indices {
            if let start = start(index), start <= visible.upperBound { next = index }
        }
        if next != activeIndex { activeIndex = next }
    }

    // MARK: - Turning

    /// Two pages at a time, turned together.
    private func spreadTurner(_ pagination: BookPagination, left: CGFloat, right: CGFloat) -> some View {
        let spreads = (pagination.pageCount + 1) / 2

        return ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(0..<spreads, id: \.self) { spread in
                    HStack(spacing: 0) {
                        bookPage(pagination, 2 * spread, width: left)
                        bookPage(pagination, 2 * spread + 1, width: right)
                    }
                    .id(spread)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollPosition(id: Binding<Int?>(
            get: { page / 2 },
            set: { if let spread = $0 { page = 2 * spread } }
        ))
        // A scroll view draws into the safe area, so without the clip the
        // next page shows under the system rail.
        .clipped()
    }

    /// One page at a time.
    private func pageTurner(_ pagination: BookPagination, pageWidth: CGFloat) -> some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(0..<pagination.pageCount, id: \.self) { index in
                    bookPage(pagination, index, width: pageWidth)
                        .id(index)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollPosition(id: Binding<Int?>(
            get: { page },
            set: { if let index = $0 { page = index } }
        ))
        .frame(width: pageWidth)
        .clipped()
    }

    /// A page: the running head, the text, and the page number. The first
    /// page opens the save, so it has no running head; a blank page at the
    /// end of a spread has neither.
    private func bookPage(_ pagination: BookPagination, _ index: Int, width: CGFloat) -> some View {
        let exists = index < pagination.pageCount

        return VStack(spacing: 0) {
            Text(exists && index > 0 ? runningHead(index) : " ")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.3)
                .textCase(.uppercase)
                .foregroundStyle(.tertiary)
                .lineLimit(1)
                .padding(.horizontal, Self.margin)
                .frame(height: Self.headHeight)

            BookPageText(pagination: pagination, page: index)
                .frame(width: textSize.width, height: textSize.height)
                .accessibilityElement()
                .accessibilityLabel(exists ? pagination.text(page: index) : "")

            Text(exists ? "\(index + 1)" : " ")
                .font(.system(size: 13))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(height: Self.folioHeight)
                .accessibilityLabel(exists ? "Page \(index + 1) of \(pagination.pageCount)" : "")
        }
        .frame(width: width, height: paneSize.height)
        .contentShape(.rect)
    }

    /// The title over a left page and the site over a right one, as a book
    /// puts its title and chapter.
    private func runningHead(_ index: Int) -> String {
        index.isMultiple(of: 2) ? (article.content.title ?? item.displayTitle) : item.displayDomain
    }

    // MARK: - Outline

    private func outlinePage(_ pagination: BookPagination) -> some View {
        BookOutlinePage(
            item: item,
            article: article,
            entryPages: pagination.entryPages,
            pageCount: pagination.pageCount,
            activeIndex: activeIndex
        ) { index, entry in
            guard let start = pagination.entryPages[entry.id] else { return }
            activeIndex = index
            if hinge == nil {
                // One page at a time, the outline is in the page's place:
                // picking a section goes back to the page.
                page = start
                showsOutline = false
            } else {
                withAnimation(.smooth(duration: 0.3)) { page = start }
            }
        }
    }
}

/// Keeps the last pagination, so the body can ask for it on every pass and
/// the text is laid out again only when the page or the type changes.
@MainActor
final class BookPaginationCache {
    private var current: BookPagination?

    func pagination(
        for key: BookPagination.Key,
        make: (BookPagination.Key) -> BookPagination
    ) -> BookPagination {
        if let current, current.key == key { return current }
        let next = make(key)
        current = next
        return next
    }
}

/// The contents page of the book: the save's front matter — where it is
/// from, its title, its Folder and Tags, its Preview Summary — and then the
/// Article Outline with the page every section starts on. The open section is
/// marked.
struct BookOutlinePage: View {
    let item: SavedItem
    let article: ReaderView.Article
    let entryPages: [String: Int]
    let pageCount: Int
    let activeIndex: Int
    let onSelect: (Int, OutlineEntry) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ReaderByline(item: item)

                Text(article.content.title ?? item.displayTitle)
                    .font(.system(size: 30, weight: .heavy))
                    .kerning(-0.4)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)

                if item.folder != nil || !item.tags.isEmpty {
                    meta
                        .padding(.top, 14)
                }

                if let summary = item.previewSummary?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !summary.isEmpty {
                    ReaderSummaryCard(summary: summary, fontSize: 17)
                        .padding(.top, 20)
                }

                if !article.outline.isEmpty {
                    HStack {
                        Text("Outline")
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(pageCount == 1 ? "1 page" : "\(pageCount) pages")
                            .foregroundStyle(.tertiary)
                    }
                    .font(.system(size: 15))
                    .padding(.top, 26)
                    .padding(.bottom, 4)

                    ForEach(Array(article.outline.enumerated()), id: \.element.id) { index, entry in
                        row(entry, at: index)
                    }
                }
            }
            .padding(.horizontal, 30)
            .padding(.top, 24)
            .padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
    }

    private var meta: some View {
        HStack(spacing: 16) {
            if let folder = item.folder {
                Label(folder.name, systemImage: "folder")
            }
            ForEach(item.tags, id: \.self) { tag in
                Label(tagDisplayName(tag), systemImage: "number")
            }
        }
        .labelStyle(ReaderMetaLabelStyle())
        .font(.system(size: 15))
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }

    private func row(_ entry: OutlineEntry, at index: Int) -> some View {
        let isActive = index == activeIndex
        let isDone = index < activeIndex

        return Button {
            onSelect(index, entry)
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("\(index + 1)")
                    .font(.system(size: 15))
                    .monospacedDigit()
                    .foregroundStyle(.tertiary)
                    .frame(minWidth: 16, alignment: .leading)

                Text(entry.title)
                    .font(.system(size: 17, weight: isActive ? .semibold : .regular))
                    .foregroundStyle(isActive ? AnyShapeStyle(.primary) : isDone ? AnyShapeStyle(.tertiary) : AnyShapeStyle(.secondary))
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if let start = entryPages[entry.id] {
                    Text("\(start + 1)")
                        .font(.system(size: 14))
                        .monospacedDigit()
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.vertical, 10)
            .padding(.leading, 16)
            .overlay(alignment: .leading) {
                if isActive {
                    Capsule()
                        .fill(.primary)
                        .frame(width: 3)
                        .padding(.vertical, 11)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.18), value: activeIndex)
        .accessibilityLabel(entry.title)
        .accessibilityValue(entryPages[entry.id].map { "Page \($0 + 1)" } ?? "")
        .accessibilityAddTraits(isActive ? [.isSelected, .isButton] : .isButton)
    }
}

/// A Folder or a Tag under the title: a small symbol, then the name.
private struct ReaderMetaLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon
                .font(.system(size: 14))
            configuration.title
        }
    }
}
