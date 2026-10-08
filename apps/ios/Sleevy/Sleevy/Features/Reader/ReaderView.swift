import MarkdownUI
import SwiftUI

/// The in-product surface that renders a Saved Item's Readable Content instead
/// of sending the reader to the Original URL (ADR 0021).
///
/// Only Markdown is rendered. The extractor's HTML is never served, so nothing
/// here sanitizes third-party markup — that is the whole reason the contract
/// serves one form and not the other.
///
/// The Original URL is always one tap away, so the Reader View is never a dead
/// end: an extraction that lost the part you wanted is a tap from the page.
///
/// Where the pane is wide enough — the iPhone Duo's inner display, an iPad —
/// it lays out as the Web Companion's Reader View does: the articles beside
/// the article, then the article itself with its Article Outline in the
/// gutter. Narrower than that, both fold away and the article takes the whole
/// width, which is the Reader View every iPhone has had.
struct ReaderView: View {
    /// The Saved Item the reader opened. The pane can move on from it without
    /// pushing a new screen, so this is where reading started rather than what
    /// is on screen now.
    let openedID: SavedItem.ID
    let store: ReadingListStore

    @State private var selectedID: SavedItem.ID
    @State private var phase: Phase = .loading
    @State private var activeIndex = 0
    /// Where each section starts within the scrolling content, by entry id.
    @State private var sectionTops: [String: CGFloat] = [:]
    @State private var scrollTop: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0
    @State private var contentHeight: CGFloat = 0
    @Environment(\.openURL) private var openURL
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    init(openedID: SavedItem.ID, store: ReadingListStore) {
        self.openedID = openedID
        self.store = store
        _selectedID = State(initialValue: openedID)
    }

    /// How wide a column of prose is allowed to get. Past roughly this the eye
    /// loses its place travelling back to the start of the next line, which is
    /// why a newspaper sets columns and not pages.
    private static let measure: CGFloat = 700

    /// The breathing room either side of the prose, inside the column.
    private static let columnPadding: CGFloat = 20

    /// What has to be left for the article before the list column earns its
    /// place. Below this the list is taking width the prose needs, and the
    /// article is reached by going back instead — the same trade the Web
    /// Companion makes when it drops the column below 1400px.
    ///
    /// Measured against the real pane rather than the display: the iPhone Duo's
    /// inner display is 951pt wide, and the vertical toolbar's safe area leaves
    /// the Reader View 867pt of it. 520pt is about 62 characters of 19pt prose,
    /// which is still a column.
    private static let minimumPaneForList: CGFloat = 520

    /// The coordinate space the section offsets are measured in: the scrolling
    /// content itself, so a section's top is its offset into the article and
    /// not its position on screen.
    private static let articleSpace = "reader.article"

    /// An article and everything derived from it, worked out once when it
    /// arrives rather than on every pass of the body.
    struct Article: Equatable {
        let content: ReadableContent
        let outline: ArticleOutline
        let sections: [ArticleSection]
    }

    /// Why the article is not on screen. The two are different states, not one
    /// message: an extraction that found nothing is settled and a reader
    /// should go to the page, while an API that cannot be reached is a
    /// question of when, and offering "Open in Browser" as the only way out of
    /// it sends people away from an article Sleevy has and will show them in a
    /// moment.
    enum Failure: Equatable {
        /// Extraction is best effort and this Link yielded no prose. Ordinary
        /// rather than an error to apologise for.
        case noArticle
        /// Sleevy could not be reached, or answered with something that was
        /// not the API. Worth trying again.
        case unreachable(String)

        var title: String {
            switch self {
            case .noArticle: "Can't read this here"
            case .unreachable: "Can't reach Sleevy"
            }
        }

        var message: String {
            switch self {
            case .noArticle:
                "Sleevy couldn't extract this page's text. The original is still there."
            case .unreachable:
                "The article is saved, but Sleevy couldn't load it just now."
            }
        }

        var isRetriable: Bool {
            if case .unreachable = self { return true }
            return false
        }

        /// Which of the two states a failed read leaves the reader in.
        ///
        /// Only a definitive rejection means the page has no article: the
        /// server looked and there was nothing. Everything else is Sleevy
        /// failing to answer, and telling a reader their article does not
        /// exist because the network dropped sends them to a browser they did
        /// not need.
        static func from(_ fault: SyncFault) -> Failure {
            switch fault {
            case .permanent: .noArticle
            case .transient(let reason), .unreachable(let reason), .authInvalid(let reason):
                .unreachable(reason)
            }
        }
    }

    enum Phase: Equatable {
        case loading
        case loaded(Article)
        case failed(Failure)
    }

    private var item: SavedItem? {
        store.savedItem(id: selectedID)
    }

    /// Every Saved Item the reader could move to from here: the Library, kept
    /// to the ones that have a Reader View so every row leads somewhere.
    private var readableItems: [SavedItem] {
        store.snapshot(for: .libraryRoot).items.filter(hasReaderView)
    }

    private var isRegularWidth: Bool {
        horizontalSizeClass == .regular
    }

    var body: some View {
        GeometryReader { geometry in
            let showsList = isRegularWidth
                && geometry.size.width - ReadableItemsSidebar.width >= Self.minimumPaneForList
                && readableItems.count > 1

            HStack(alignment: .top, spacing: 0) {
                if showsList {
                    ReadableItemsSidebar(items: readableItems, selectedID: selectedID) { next in
                        select(next.id)
                    }

                    Divider()
                }

                articlePane(paneWidth: geometry.size.width - (showsList ? ReadableItemsSidebar.width + 1 : 0))
            }
        }
        .navigationTitle(item?.displayTitle ?? "")
        .navigationBarTitleDisplayMode(.inline)
        // The one screen in the app that hides the tab bar. Everywhere else
        // content scrolling under the floating bar is fine; here it sits on
        // top of the last lines of the article, and a reading surface should
        // be the article and nothing else.
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Open in Browser", systemImage: "safari") { openOriginal() }
                    if case .loaded(let article) = phase {
                        ShareLink(item: URL(string: article.content.originalURL) ?? url) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                    }
                } label: {
                    Label("More", systemImage: "ellipsis.circle")
                }
            }
        }
        .task(id: selectedID) { await loadContent() }
        // The list beside the article is the Library, which the reader may
        // never have opened — arriving straight here from the Inbox, a widget,
        // or a capture leaves that scope unread.
        .task { await store.loadIfNeeded(for: .libraryRoot) }
    }

    // MARK: - Panes

    /// The article, with its Article Outline in the leading gutter where the
    /// column leaves one.
    private func articlePane(paneWidth: CGFloat) -> some View {
        let layout = Layout(paneWidth: paneWidth, hasOutline: hasOutline)

        return ScrollViewReader { proxy in
            HStack(alignment: .top, spacing: 0) {
                if layout.showsRail, case .loaded(let article) = phase {
                    OutlineRail(outline: article.outline, activeIndex: activeIndex) { entry in
                        withAnimation(.easeOut(duration: 0.25)) {
                            proxy.scrollTo(entry.id, anchor: .top)
                        }
                    }
                    .frame(width: layout.railWidth)
                    .frame(width: layout.gutter, alignment: .trailing)
                }

                Group {
                    switch phase {
                    case .loading:
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    case .loaded(let article):
                        scrollingArticle(article)
                    case .failed(let failure):
                        unavailable(failure)
                    }
                }
                .frame(maxWidth: layout.columnWidth)

                if layout.showsRail {
                    // The matching gutter on the other side, so the column is
                    // centred rather than pushed off the rail.
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private var hasOutline: Bool {
        if case .loaded(let article) = phase { return !article.outline.isEmpty }
        return false
    }

    /// How the article pane divides between the outline gutter and the column.
    private struct Layout {
        let columnWidth: CGFloat
        let gutter: CGFloat
        let railWidth: CGFloat
        let showsRail: Bool

        init(paneWidth: CGFloat, hasOutline: Bool) {
            let column = min(ReaderView.measure + 2 * ReaderView.columnPadding, paneWidth)
            let side = max(0, (paneWidth - column) / 2)

            showsRail = hasOutline && side >= OutlineRail.minimumGutter
            gutter = showsRail ? side : 0
            railWidth = max(0, gutter - 16)
            columnWidth = column
        }
    }

    private func scrollingArticle(_ article: Article) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // The article's own title, not the row's: the extractor read
                // the page and the Saved Metadata read the tags, and when they
                // disagree the page is the one that was written by a person.
                Text(article.content.title ?? item?.displayTitle ?? "")
                    .font(isRegularWidth ? .system(size: 40, weight: .bold) : .largeTitle.weight(.bold))

                if let item {
                    Text(item.displayDomain)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                ForEach(article.sections) { section in
                    Markdown(section.markdown)
                        .markdownTheme(.sleevyReader(isRegularWidth: isRegularWidth))
                        .id(section.id)
                        .onGeometryChange(for: CGFloat.self) { proxy in
                            proxy.frame(in: .named(Self.articleSpace)).minY
                        } action: { top in
                            guard let entryID = section.entryID else { return }
                            sectionTops[entryID] = top
                            updateActiveEntry(article.outline)
                        }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Self.columnPadding)
            .padding(.top, 8)
            .padding(.bottom, 48)
            .coordinateSpace(.named(Self.articleSpace))
        }
        .onScrollGeometryChange(for: ScrollGeometry.self) { $0 } action: { _, geometry in
            // Normalised so that resting at the top of the article is zero,
            // whatever inset the navigation bar is claiming this frame.
            scrollTop = geometry.contentOffset.y + geometry.contentInsets.top
            viewportHeight = geometry.containerSize.height
            contentHeight = geometry.contentSize.height
            updateActiveEntry(article.outline)
        }
    }

    private func unavailable(_ failure: Failure) -> some View {
        ContentUnavailableView {
            Label(
                failure.title,
                systemImage: failure.isRetriable ? "wifi.exclamationmark" : "doc.text.magnifyingglass"
            )
        } description: {
            Text(failure.message)
        } actions: {
            VStack(spacing: 12) {
                if failure.isRetriable {
                    Button("Try Again") {
                        phase = .loading
                        Task { await loadContent() }
                    }
                    .buttonStyle(.borderedProminent)
                }

                // The prominent action is whichever one is likely to work: try
                // again when Sleevy is simply out of reach, the page itself
                // when there was never an article to read.
                if failure.isRetriable {
                    Button("Open in Browser") { openOriginal() }
                        .buttonStyle(.bordered)
                } else {
                    Button("Open in Browser") { openOriginal() }
                        .buttonStyle(.borderedProminent)
                }
            }
        }
    }

    // MARK: - Behaviour

    private var url: URL {
        guard let item else { return URL(string: "https://sleevy.app")! }
        return URL(string: item.originalURL) ?? URL(string: "https://\(item.host)")!
    }

    private func openOriginal() {
        openURL(url)
    }

    /// Move to another article without leaving the Reader View. In this pane
    /// the list and the article are the same choice, so picking a row opens
    /// it rather than only pointing at it.
    private func select(_ id: SavedItem.ID) {
        guard id != selectedID else { return }
        selectedID = id
        phase = .loading
        sectionTops = [:]
        activeIndex = 0
        scrollTop = 0

        if let next = store.savedItem(id: id) {
            // The same Open Action a row tap makes (ADR 0021): reading it here
            // counts as reading it.
            Task { await store.recordOpen(next) }
        }
    }

    /// Which mark the rail lights, from the same arithmetic the Web Companion
    /// uses. A section the layout has not reported yet is not a place the
    /// reader can be, so it never claims the mark.
    private func updateActiveEntry(_ outline: ArticleOutline) {
        guard !outline.isEmpty else { return }

        let tops = outline.map { sectionTops[$0.id] ?? .greatestFiniteMagnitude }
        let next = activeOutlineIndex(
            tops: tops,
            scrollTop: scrollTop,
            viewportHeight: viewportHeight,
            contentHeight: contentHeight
        )

        // Only on a real change. The geometry callbacks fire for every frame
        // of every gesture, and answering each one would rebuild the article.
        if next != activeIndex {
            activeIndex = next
        }
    }

    private func loadContent() async {
        guard let item else { return }

        // A Post has no Readable Content and never will: extraction gets
        // nothing from a client-rendered timeline. Capture already resolved
        // the message, so render that rather than asking for an article the
        // server will answer 404 for.
        if !item.hasReadableContent, item.type == "post" {
            phase = .loaded(Self.prepare(Self.postContent(for: item)))
            return
        }

        do {
            let content = try await store.readableContent(itemId: item.id)
            // Off the main actor: the outline scans every line of the article,
            // and a long one should not hold up the first frame.
            let article = await Task.detached { Self.prepare(content) }.value
            // The reader may have moved on while this was in flight.
            guard content.savedItemId == selectedID else { return }
            phase = .loaded(article)
        } catch {
            guard item.id == selectedID else { return }

            phase = .failed(.from(error))
        }
    }

    private static func prepare(_ content: ReadableContent) -> Article {
        let outline = articleOutline(content.markdown)
        return Article(
            content: content,
            outline: outline,
            sections: articleSections(markdown: content.markdown, outline: outline)
        )
    }

    /// A Post is its own preview: the message capture resolved, rendered as the
    /// article. Mirrors the Web Companion, which gives a Post a Reader View for
    /// the same reason.
    private static func postContent(for item: SavedItem) -> ReadableContent {
        ReadableContent(
            savedItemId: item.id,
            originalURL: item.originalURL,
            title: item.title,
            markdown: item.description ?? item.previewSummary ?? "",
            extractedAt: item.lastSavedAt
        )
    }
}

// MARK: - Theme

extension MarkdownUI.Theme {
    /// Reader typography: one column, generous leading, and a measure that
    /// stays readable when the Duo unfolds. Semantic colors throughout, so the
    /// Theme setting (System / Light / Dark) governs the Reader View too.
    ///
    /// The inner display is read at arm's length rather than in the hand, so
    /// the body grows with the pane. The measure is capped either way, so the
    /// larger size is more words on a line the eye can still track, not a
    /// longer line.
    static func sleevyReader(isRegularWidth: Bool) -> MarkdownUI.Theme {
        let body: CGFloat = isRegularWidth ? 19 : 17

        return MarkdownUI.Theme()
            .text {
                FontSize(body)
                ForegroundColor(.primary)
            }
            .code {
                FontFamilyVariant(.monospaced)
                FontSize(.em(0.92))
            }
            .link {
                ForegroundColor(.accentColor)
            }
            .heading1 { configuration in
                configuration.label
                    .markdownMargin(top: 28, bottom: 10)
                    .markdownTextStyle { FontWeight(.bold); FontSize(.em(1.5)) }
            }
            .heading2 { configuration in
                configuration.label
                    .markdownMargin(top: 24, bottom: 8)
                    .markdownTextStyle { FontWeight(.semibold); FontSize(.em(1.28)) }
            }
            .heading3 { configuration in
                configuration.label
                    .markdownMargin(top: 20, bottom: 6)
                    .markdownTextStyle { FontWeight(.semibold); FontSize(.em(1.1)) }
            }
            .paragraph { configuration in
                configuration.label
                    .lineSpacing(isRegularWidth ? 7 : 6)
                    .markdownMargin(top: 0, bottom: 14)
            }
            .blockquote { configuration in
                configuration.label
                    .padding(.leading, 14)
                    .overlay(alignment: .leading) {
                        Rectangle()
                            .fill(Color.secondary.opacity(0.35))
                            .frame(width: 3)
                    }
                    .markdownTextStyle { FontStyle(.italic); ForegroundColor(.secondary) }
            }
    }
}
