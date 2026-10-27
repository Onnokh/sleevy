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
/// The article scrolls: its title, where it is from, the Preview Summary,
/// then the prose. The arrows in the bar step to the save above or below in
/// the list it was opened from. Where the pane is wide enough — an iPad — the
/// articles sit beside the article, as in the Web Companion's Reader View,
/// with the Article Outline in the gutter.
///
/// Where the device has a vertical bar — the iPhone Duo — the reader's
/// actions go in the bar, beside the wheel that turns to a section.
struct ReaderView: View {
    /// The Saved Item the reader opened. The pane can move on from it without
    /// pushing a new screen, so this is where reading started rather than what
    /// is on screen now.
    let openedID: SavedItem.ID
    /// The list the save was opened from, in its order at that moment. Taken
    /// then, not read live: the Inbox drops a save as soon as it is read, and
    /// the arrows should still step to the saves that were around it.
    let sequence: [SavedItem.ID]
    let store: ReadingListStore

    @State private var selectedID: SavedItem.ID
    @State private var phase: Phase = .loading
    @State private var activeIndex = 0
    /// Where each section starts within the scrolling content, by entry id.
    @State private var sectionTops: [String: CGFloat] = [:]
    @State private var scrollTop: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0
    @State private var contentHeight: CGFloat = 0
    @State private var isCreased = false
    /// The reader's finger on the scrubber in the vertical bar, while it is
    /// down.
    @State private var scrub: OutlineScrub?
    /// The section the scrubber last asked for; the article goes to it.
    @State private var scrubTarget: String?
    /// Which side of the screen the vertical bar is on, or nil where there is
    /// none.
    @State private var barEdge: HorizontalEdge?
    /// The reader's type size, in steps from the default.
    @AppStorage("readerTextSize", store: SleevyUserPreferences.defaults)
    private var textSizeStep = 0
    @Environment(\.openURL) private var openURL
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.moveToFolder) private var moveToFolder
    @Environment(\.readerSidebarSelection) private var sidebarSelection
    @Environment(\.dismiss) private var dismiss

    init(openedID: SavedItem.ID, sequence: [SavedItem.ID] = [], store: ReadingListStore) {
        self.openedID = openedID
        self.sequence = sequence
        self.store = store
        _selectedID = State(initialValue: openedID)
    }

    /// How wide a column of prose is allowed to get. Past roughly this the eye
    /// loses its place travelling back to the start of the next line, which is
    /// why a newspaper sets columns and not pages.
    private static let measure: CGFloat = 700

    /// The breathing room either side of the prose, inside the column.
    private static let columnPadding: CGFloat = 22

    /// What has to be left for the article before the list column earns its
    /// place. Below this the list is taking width the prose needs, and the
    /// article is reached by going back instead — the same trade the Web
    /// Companion makes when it drops the column below 1400px.
    private static let minimumPaneForList: CGFloat = 520

    /// The list's share of the window beside a flat article: enough for two
    /// lines of title, and the rest stays the article's.
    private static let listShare: CGFloat = 0.25

    /// The narrowest the list gets, so a small window still shows a title in
    /// two lines rather than four.
    private static let minimumListWidth: CGFloat = 220

    /// The type size steps a reader can take from the default.
    private static let textSizeSteps = -2...4

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

    private var hasVerticalBar: Bool {
        barEdge != nil
    }

    private var textScale: CGFloat {
        1 + CGFloat(textSizeStep) * 0.1
    }

    var body: some View {
        GeometryReader { geometry in
            columns(in: geometry)
        }
        .background(Color(.systemBackground))
        .overlay { scrubDeck }
        .animation(.smooth(duration: 0.35), value: isCreased)
        .onCreaseChange { isCreased = $0 }
        .verticalBarToolbar(isEnabled: hasVerticalBar) {
            ToolbarItem(placement: .bottomBar) {
                Menu {
                    textSizeControls
                } label: {
                    Label("Text Size", systemImage: "textformat.size")
                }
            }
            ToolbarItem(placement: .bottomBar) {
                moreMenu
            }
        }
        .outlineScrubber(
            outline: loadedOutline,
            activeIndex: activeIndex,
            onScrub: scrubbed,
            onEdgeChange: { barEdge = $0 }
        )
        .navigationTitle(item?.displayTitle ?? "")
        .navigationBarTitleDisplayMode(.inline)
        // The article sets its own title, large, under the bar.
        .toolbar(removing: .title)
        // The one screen in the app that hides the tab bar. Everywhere else
        // content scrolling under the floating bar is fine; here it sits on
        // top of the last lines of the article, and a reading surface should
        // be the article and nothing else.
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            if !hasVerticalBar {
                if sequence.count > 1 {
                    ToolbarItemGroup(placement: .topBarLeading) {
                        Button {
                            step(by: -1)
                        } label: {
                            Label("Previous Save", systemImage: "chevron.up")
                        }
                        .disabled(neighbour(by: -1) == nil)

                        Button {
                            step(by: 1)
                        } label: {
                            Label("Next Save", systemImage: "chevron.down")
                        }
                        .disabled(neighbour(by: 1) == nil)
                    }
                }

                ToolbarItemGroup(placement: .topBarTrailing) {
                    if let item {
                        readButton(item)
                        if let moveToFolder {
                            MoveToFolderMenu(item: item, action: moveToFolder)
                        }
                    }
                    moreMenu
                }
            }
        }
        .task(id: selectedID) { await loadContent() }
        .onAppear { sidebarSelection?.wrappedValue = selectedID }
        .onChange(of: selectedID) { _, id in sidebarSelection?.wrappedValue = id }
        .onChange(of: sidebarSelection?.wrappedValue ?? nil) { _, id in
            if let id { select(id) }
        }
        // The list beside the article is the Library, which the reader may
        // never have opened — arriving straight here from the Inbox, a widget,
        // or a capture leaves that scope unread.
        .task { await store.loadIfNeeded(for: .libraryRoot) }
    }

    // MARK: - Panes

    /// The scrolling article, with the articles beside it where the pane
    /// leaves room for them.
    private func columns(in geometry: GeometryProxy) -> some View {
        let listWidth = listWidth(in: geometry)

        return HStack(alignment: .top, spacing: 0) {
            if let listWidth {
                ReadableItemsSidebar(items: readableItems, selectedID: selectedID, width: listWidth) { next in
                    select(next.id)
                }

                Divider()
            }

            articlePane(paneWidth: geometry.size.width - (listWidth.map { $0 + 1 } ?? 0))
        }
    }

    /// How wide the list beside the article is, or nil when there is no room
    /// for one: a quarter of the window, and only while the article keeps a
    /// column beside it.
    private func listWidth(in geometry: GeometryProxy) -> CGFloat? {
        guard sidebarSelection == nil, isRegularWidth, readableItems.count > 1 else { return nil }

        let leadingEdge = geometry.frame(in: .global).minX
        let windowWidth = leadingEdge + geometry.size.width + geometry.safeAreaInsets.trailing

        if isCreased, geometry.size.width > geometry.size.height {
            return windowWidth / 2 - leadingEdge
        }

        let width = max(Self.minimumListWidth, windowWidth * Self.listShare)
        return geometry.size.width - width - 1 >= Self.minimumPaneForList ? width : nil
    }

    /// The article, with its Article Outline in the leading gutter where the
    /// column leaves one.
    private func articlePane(paneWidth: CGFloat) -> some View {
        let layout = Layout(paneWidth: paneWidth, hasOutline: !loadedOutline.isEmpty)
        // A wide column is read at arm's length, and set a size up.
        let largeType = isRegularWidth && layout.columnWidth >= Self.minimumPaneForList

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
                        scrollingArticle(article, largeType: largeType)
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
            // Centred where the pane is wider than the column and there is no
            // rail, as when the sidebar closes beside it.
            .frame(maxWidth: .infinity)
            // No animation: the article keeps up with the finger, and a scroll
            // still easing towards one section when the finger is on the next
            // reads as lag.
            .onChange(of: scrubTarget) { _, target in
                if let target { proxy.scrollTo(target, anchor: .top) }
            }
        }
    }

    private var loadedOutline: ArticleOutline {
        if case .loaded(let article) = phase { return article.outline }
        return []
    }

    /// The deck of section cards beside the scrubber, level with the pointed
    /// mark, on the side of the bar the article is on. Not while the book's
    /// outline is open: the whole outline is on the page already.
    @ViewBuilder
    private var scrubDeck: some View {
        GeometryReader { geometry in
            if let scrub, let barEdge, loadedOutline.indices.contains(scrub.index) {
                let origin = geometry.frame(in: .global).origin
                let gap: CGFloat = 12
                let half = OutlineDeck.width / 2
                let x = barEdge == .trailing
                    ? scrub.frame.minX - gap - half
                    : scrub.frame.maxX + gap + half
                // Kept clear of the pane's ends, so the cards either side of
                // the first and last sections are not cut off.
                let y = min(max(scrub.markY - origin.y, 110), geometry.size.height - 110)

                OutlineDeck(outline: loadedOutline, frontIndex: scrub.index)
                    .position(x: x - origin.x, y: y)
                    .animation(OutlineDeck.travel, value: y)
                    .transition(.opacity.animation(.easeOut(duration: 0.14)))
            }
        }
        .allowsHitTesting(false)
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

    private func scrollingArticle(_ article: Article, largeType: Bool) -> some View {
        let bodySize = ((largeType ? 19 : 18) * textScale).rounded()

        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                articleHeader(article, largeType: largeType, bodySize: bodySize)
                    .padding(.bottom, 28)

                // Each section is its own Markdown view, and a view drops the
                // margin above its first heading: the gap is set here instead.
                VStack(alignment: .leading, spacing: 30) {
                    ForEach(article.sections) { section in
                        Markdown(section.markdown)
                            .markdownTheme(.sleevyReader(bodySize: bodySize))
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
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Self.columnPadding)
            .padding(.top, 6)
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

    /// The article's own title, where it is from, and its Preview Summary.
    ///
    /// The title is the article's, not the row's: the extractor read the page
    /// and the Saved Metadata read the tags, and when they disagree the page
    /// is the one that was written by a person.
    @ViewBuilder
    private func articleHeader(_ article: Article, largeType: Bool, bodySize: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(article.content.title ?? item?.displayTitle ?? "")
                .font(.system(size: largeType ? 38 : 32, weight: .heavy))
                .kerning(-0.5)
                .fixedSize(horizontal: false, vertical: true)

            if let item {
                ReaderByline(item: item, showsAge: false)
                    .padding(.top, 14)

                if let summary = item.previewSummary?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !summary.isEmpty {
                    ReaderSummaryCard(summary: summary, fontSize: bodySize)
                        .padding(.top, 24)
                }
            }
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
                    .buttonStyle(.prominent)
                }

                // The prominent action is whichever one is likely to work: try
                // again when Sleevy is simply out of reach, the page itself
                // when there was never an article to read.
                if failure.isRetriable {
                    Button("Open in Browser") { openOriginal() }
                        .buttonStyle(.bordered)
                } else {
                    Button("Open in Browser") { openOriginal() }
                        .buttonStyle(.prominent)
                }
            }
        }
    }

    // MARK: - Actions

    private func readButton(_ item: SavedItem) -> some View {
        Button {
            Task { await store.setRead(item, isRead: !item.isRead) }
        } label: {
            Label(
                item.isRead ? "Mark Unread" : "Mark Read",
                systemImage: item.isRead ? "checkmark.circle.fill" : "checkmark.circle"
            )
        }
    }

    /// Everything else the reader can do with the save. The vertical bar is
    /// shorter, so with it Mark Read and Move to Folder are in here too.
    private var moreMenu: some View {
        Menu {
            if hasVerticalBar, let item {
                readButton(item)
                if let moveToFolder {
                    MoveToFolderMenu(item: item, action: moveToFolder)
                }
                Divider()
            }

            if !hasVerticalBar {
                textSizeControls
            }

            Button("Open in Browser", systemImage: "safari") { openOriginal() }
            ShareLink(item: url) {
                Label("Share", systemImage: "square.and.arrow.up")
            }
            Button("Copy Link", systemImage: "link") { copyLink(url) }

            if let item {
                Divider()
                Button("Delete", systemImage: "trash", role: .destructive) {
                    Task {
                        await store.delete(item)
                        dismiss()
                    }
                }
            }
        } label: {
            Label("More", systemImage: "ellipsis")
        }
    }

    private var textSizeControls: some View {
        ControlGroup {
            Button {
                textSizeStep = max(textSizeStep - 1, Self.textSizeSteps.lowerBound)
            } label: {
                Label("Smaller Text", systemImage: "textformat.size.smaller")
            }
            .disabled(textSizeStep <= Self.textSizeSteps.lowerBound)

            Button {
                textSizeStep = min(textSizeStep + 1, Self.textSizeSteps.upperBound)
            } label: {
                Label("Larger Text", systemImage: "textformat.size.larger")
            }
            .disabled(textSizeStep >= Self.textSizeSteps.upperBound)
        } label: {
            Text("Text Size")
        }
    }

    // MARK: - Behaviour

    private var url: URL {
        guard let item else { return URL(string: "https://sleevy.app")! }
        return item.shareURL ?? URL(string: item.originalURL) ?? URL(string: "https://\(item.host)")!
    }

    private func openOriginal() {
        openURL(url)
    }

    /// The save `offset` places from this one in the list it was opened from,
    /// or nil at either end.
    private func neighbour(by offset: Int) -> SavedItem.ID? {
        guard let index = sequence.firstIndex(of: selectedID) else { return nil }
        let next = index + offset
        return sequence.indices.contains(next) ? sequence[next] : nil
    }

    private func step(by offset: Int) {
        guard let next = neighbour(by: offset) else { return }
        select(next)
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

    /// The scrubber pointed at a section, or let go. A scrub with no frame
    /// is a jump from an assistive technology: the article moves, and there
    /// is no finger for a deck to sit beside.
    ///
    /// A finger that only rests on the wheel points at the section being
    /// read. That shows the deck and leaves the article where it is, rather
    /// than jumping back to the top of the section.
    private func scrubbed(_ next: OutlineScrub?) {
        guard let next else {
            scrub = nil
            scrubTarget = nil
            return
        }
        scrub = next.frame == .zero ? nil : next
        if next.index != activeIndex {
            scrubTarget = loadedOutline[next.index].id
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

// MARK: - Article header

/// Where a save is from: its favicon and its site, with how long ago it was
/// saved where that helps.
struct ReaderByline: View {
    let item: SavedItem
    var showsAge = true

    var body: some View {
        HStack(spacing: 8) {
            SavedItemFavicon(item: item, size: 20)
                .clipShape(.rect(cornerRadius: 5, style: .continuous))

            Text(showsAge ? "\(item.displayDomain) · \(item.createdDateLabel)" : item.displayDomain)
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }
}

/// The Preview Summary as a card over the article, which folds away to its
/// heading for a reader who would rather start on the text.
struct ReaderSummaryCard: View {
    let summary: String
    var fontSize: CGFloat = 18

    @State private var isExpanded = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.snappy(duration: 0.24)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 7) {
                    Text("Summary")
                        .font(.system(size: 15, weight: .semibold))
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .rotationEffect(.degrees(isExpanded ? 0 : -90))
                }
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")

            if isExpanded {
                Text(summary)
                    .font(.system(size: fontSize))
                    .lineSpacing(fontSize * 0.3)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 15)
        .padding(.bottom, isExpanded ? 18 : 15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 22, style: .continuous))
    }
}

// MARK: - Theme

extension MarkdownUI.Theme {
    /// Reader typography: one column, generous leading, gray prose under
    /// white headings, so the eye finds the sections before the sentences.
    /// Semantic colors throughout, so the Theme setting (System / Light /
    /// Dark) governs the Reader View too.
    static func sleevyReader(bodySize: CGFloat) -> MarkdownUI.Theme {
        MarkdownUI.Theme()
            .text {
                FontSize(bodySize)
                ForegroundColor(.secondary)
            }
            .code {
                FontFamilyVariant(.monospaced)
                FontSize(.em(0.9))
            }
            .strong {
                FontWeight(.semibold)
                ForegroundColor(.primary)
            }
            .link {
                ForegroundColor(.primary)
                UnderlineStyle(.single)
            }
            .heading1 { configuration in
                configuration.label
                    .markdownMargin(top: 30, bottom: 10)
                    .markdownTextStyle { FontWeight(.bold); FontSize(.em(1.4)); ForegroundColor(.primary) }
            }
            .heading2 { configuration in
                configuration.label
                    .markdownMargin(top: 28, bottom: 10)
                    .markdownTextStyle { FontWeight(.bold); FontSize(.em(1.17)); ForegroundColor(.primary) }
            }
            .heading3 { configuration in
                configuration.label
                    .markdownMargin(top: 22, bottom: 8)
                    .markdownTextStyle { FontWeight(.semibold); FontSize(.em(1.06)); ForegroundColor(.primary) }
            }
            .paragraph { configuration in
                configuration.label
                    .lineSpacing(bodySize * 0.42)
                    .markdownMargin(top: 0, bottom: 16)
            }
            .listItem { configuration in
                configuration.label
                    .markdownMargin(top: 8)
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
