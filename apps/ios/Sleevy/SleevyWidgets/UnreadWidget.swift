import AppIntents
import CryptoKit
import SwiftUI
import WidgetKit

// MARK: - Configuration

/// Which unread scope the widget follows: the whole Inbox by default, or one
/// Folder's share of it.
struct UnreadWidgetConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Inbox" }
    static var description: IntentDescription {
        IntentDescription("Shows your unread saves, or those of one folder.")
    }

    /// Optional because WidgetKit requires it of every widget parameter;
    /// `init()` fills in the Inbox, and a nil that still gets through reads
    /// as the Inbox too.
    @Parameter(title: "Show")
    var scope: WidgetScope?

    /// The scope to draw: the Inbox unless a Folder was picked.
    var resolvedScope: WidgetScope { scope ?? .inbox }

    init() {
        scope = .inbox
    }

    init(scope: WidgetScope) {
        self.scope = scope
    }
}

/// One entry of the "Show" picker: the whole Inbox, or a Folder from the
/// published snapshot. The sheet never asks the API for the Folder list.
struct WidgetScope: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Scope" }
    static var defaultQuery: WidgetScopeQuery { WidgetScopeQuery() }

    static let inboxID = "inbox"
    static let inbox = WidgetScope(id: inboxID, name: "Inbox", color: nil)

    let id: String
    let name: String
    /// The Folder's stored colour name; nil for the Inbox.
    let color: String?

    var isInbox: Bool { id == Self.inboxID }

    /// The picker row: the Inbox wears the system tray; a Folder wears a
    /// folder glyph in the mid tone of the palette its card wears.
    var displayRepresentation: DisplayRepresentation {
        if isInbox {
            return DisplayRepresentation(title: "\(name)", image: .init(systemName: "tray"))
        }
        if let data = Self.folderIconData(palette: FolderCardPalette.named(color)) {
            return DisplayRepresentation(title: "\(name)", image: .init(data: data))
        }
        return DisplayRepresentation(title: "\(name)", image: .init(systemName: "folder.fill"))
    }

    /// Rasterizes a tinted folder glyph: `DisplayRepresentation.Image` takes
    /// a plain system name or bitmap data, and only the bitmap can carry a
    /// colour.
    private static func folderIconData(palette: FolderCardPalette) -> Data? {
        let tint = UIColor(
            red: CGFloat(palette.mid.x),
            green: CGFloat(palette.mid.y),
            blue: CGFloat(palette.mid.z),
            alpha: 1
        )
        let configuration = UIImage.SymbolConfiguration(pointSize: 44, weight: .semibold)
        return UIImage(systemName: "folder.fill", withConfiguration: configuration)?
            .withTintColor(tint, renderingMode: .alwaysOriginal)
            .pngData()
    }

    init(id: String, name: String, color: String?) {
        self.id = id
        self.name = name
        self.color = color
    }

    init(_ folder: UnreadBacklogSnapshot.Folder) {
        self.init(id: folder.id, name: folder.name, color: folder.color)
    }
}

struct WidgetScopeQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [WidgetScope] {
        publishedScopes().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [WidgetScope] {
        publishedScopes()
    }

    func defaultResult() async -> WidgetScope? {
        .inbox
    }

    /// The Inbox first, then the Folders as the app published them.
    private func publishedScopes() -> [WidgetScope] {
        [.inbox] + (UnreadBacklogSnapshot.load()?.folders ?? []).map(WidgetScope.init)
    }
}

// MARK: - Row intent

/// A row tap: mark the Saved Item read and open its link, without bringing
/// the app forward. The widget holds no credentials, so the read goes into
/// the shared read-state queue the app drains on its next sync; the published
/// snapshot is updated in place so the row leaves the widget at once.
struct OpenSavedItemIntent: AppIntent {
    static var title: LocalizedStringResource { "Open Saved Item" }
    static var description: IntentDescription {
        IntentDescription("Opens an unread save from the widget and marks it read.")
    }
    /// A row action, not a Shortcuts verb.
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Saved Item")
    var itemID: String

    @Parameter(title: "Link")
    var url: URL

    init() {
        itemID = ""
        url = URL(string: "https://sleevy.app")!
    }

    init(itemID: String, url: URL) {
        self.itemID = itemID
        self.url = url
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        if let snapshot = UnreadBacklogSnapshot.load() {
            let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: SleevyUserPreferences.appGroupIdentifier
            )
            ReadStateQueue(userId: snapshot.accountID, containerURL: container)
                .enqueue(itemId: itemID, isRead: true)

            snapshot.removing(itemID: itemID).save()
            WidgetCenter.shared.reloadTimelines(ofKind: UnreadBacklogSnapshot.widgetKind)
        }

        return .result(opensIntent: OpenURLIntent(url))
    }
}

// MARK: - Timeline

struct UnreadEntry: TimelineEntry {
    enum State {
        /// The published scope the widget follows.
        case backlog(UnreadScope)
        /// Nothing published: no account has signed in on this device.
        case signedOut
        /// The configured Folder is no longer in the published list.
        case missingFolder
    }

    let date: Date
    let state: State
}

/// One unread scope as the widget draws it: the whole Inbox or one Folder.
struct UnreadScope {
    let title: String
    let isInbox: Bool
    let palette: MeshPalette
    let count: Int
    let rows: [UnreadRow]
    /// Where a tap outside the rows goes.
    let link: URL
}

/// One unread Saved Item as the widget draws it. The favicon is resolved
/// ahead of time because a widget view cannot load anything itself.
struct UnreadRow: Identifiable {
    let id: String
    let title: String
    let host: String
    let favicon: UIImage?
    /// The Original URL the row opens.
    let url: URL
    let lastSavedAt: Date

    var monogram: String { String(host.prefix(1)).uppercased() }
}

struct UnreadProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> UnreadEntry {
        UnreadEntry(date: .now, state: .backlog(Self.sampleScope(relativeTo: .now)))
    }

    func snapshot(for configuration: UnreadWidgetConfigurationIntent, in context: Context) async -> UnreadEntry {
        if context.isPreview {
            return placeholder(in: context)
        }

        return await Self.entry(for: configuration, at: .now)
    }

    func timeline(for configuration: UnreadWidgetConfigurationIntent, in context: Context) async -> Timeline<UnreadEntry> {
        let now = Date.now
        let entry = await Self.entry(for: configuration, at: now)

        // The data only changes when the app publishes again, and the app
        // reloads this timeline when it does. The later entries carry the
        // same state so the recency labels keep counting up between
        // publishes.
        var entries = [entry]
        for hours in [1, 2, 4, 8, 12] {
            entries.append(UnreadEntry(
                date: now.addingTimeInterval(Double(hours) * 60 * 60),
                state: entry.state
            ))
        }

        return Timeline(entries: entries, policy: .atEnd)
    }

    private static func entry(for configuration: UnreadWidgetConfigurationIntent, at date: Date) async -> UnreadEntry {
        guard let snapshot = UnreadBacklogSnapshot.load() else {
            return UnreadEntry(date: date, state: .signedOut)
        }

        let scope: UnreadBacklogSnapshot.Scope
        let title: String
        let palette: MeshPalette
        let link: URL

        let configured = configuration.resolvedScope
        if !configured.isInbox {
            guard let folder = snapshot.folders.first(where: { $0.id == configured.id }) else {
                return UnreadEntry(date: date, state: .missingFolder)
            }

            scope = snapshot.folderScopes[folder.id] ?? .empty
            title = folder.name
            palette = .folder(FolderCardPalette.named(folder.color))
            link = SleevyDeepLink.folder(id: folder.id).url
        } else {
            scope = snapshot.inbox
            title = "Inbox"
            palette = .inbox
            link = SleevyDeepLink.inbox.url
        }

        let favicons = await UnreadWidgetFavicons.load(for: scope.items)
        let rows = scope.items.map { item in
            UnreadRow(
                id: item.id,
                title: item.title,
                host: item.host,
                favicon: favicons[item.id],
                url: item.url,
                lastSavedAt: item.lastSavedAt
            )
        }

        return UnreadEntry(date: date, state: .backlog(UnreadScope(
            title: title,
            isInbox: configured.isInbox,
            palette: palette,
            count: scope.unreadCount,
            rows: rows,
            link: link
        )))
    }

    /// What the widget gallery shows: a lively Inbox without a session.
    private static func sampleScope(relativeTo now: Date) -> UnreadScope {
        let samples: [(String, String, TimeInterval)] = [
            ("Fast Software, the Best Software", "craigmod.com", 35 * 60),
            ("How to Do Great Work", "paulgraham.com", 2 * 3_600),
            ("Observation in SwiftUI, explained", "swiftbysundell.com", 3 * 3_600),
            ("The Year in Math", "quantamagazine.org", 4 * 3_600),
            ("Invisible Details of Interaction Design", "rauno.me", 6 * 3_600),
            ("The quiet return of the personal website", "theverge.com", 8 * 3_600),
            ("A Guide to Making Ramen at Home", "seriouseats.com", 26 * 3_600),
            ("Notes on Walking the Dolomites", "alpinejournal.org", 50 * 3_600),
        ]

        let rows = samples.enumerated().map { index, sample in
            UnreadRow(
                id: "sample-\(index)",
                title: sample.0,
                host: sample.1,
                favicon: nil,
                url: URL(string: "https://\(sample.1)")!,
                lastSavedAt: now.addingTimeInterval(-sample.2)
            )
        }

        return UnreadScope(
            title: "Inbox",
            isInbox: true,
            palette: .inbox,
            count: 12,
            rows: rows,
            link: SleevyDeepLink.inbox.url
        )
    }
}

// MARK: - Favicons

/// Fetches and downsamples the row favicons in the timeline provider, where a
/// widget may still use the network, and keeps the bytes in the app group so
/// later reloads are free. An SVG favicon has no renderer here and falls back
/// to the monogram, as it would in the app without WebKit.
nonisolated enum UnreadWidgetFavicons {
    private static let renderedSize = CGSize(width: 64, height: 64)

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 4
        configuration.timeoutIntervalForResource = 6
        return URLSession(configuration: configuration)
    }()

    private static let cacheDirectory: URL = {
        let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SleevyUserPreferences.appGroupIdentifier
        ) ?? FileManager.default.temporaryDirectory

        return container
            .appendingPathComponent("Library/Caches/UnreadWidgetFavicons", isDirectory: true)
    }()

    static func load(for items: [UnreadBacklogSnapshot.Item]) async -> [String: UIImage] {
        await withTaskGroup(of: (String, UIImage?).self) { group in
            for item in items {
                guard
                    let url = item.faviconURL,
                    url.pathExtension.caseInsensitiveCompare("svg") != .orderedSame
                else { continue }

                group.addTask { (item.id, await image(for: url)) }
            }

            var favicons: [String: UIImage] = [:]
            for await (id, image) in group {
                if let image {
                    favicons[id] = image
                }
            }
            return favicons
        }
    }

    private static func image(for url: URL) async -> UIImage? {
        guard let data = await data(for: url), let image = UIImage(data: data) else {
            return nil
        }

        return await image.byPreparingThumbnail(ofSize: renderedSize) ?? image
    }

    private static func data(for url: URL) async -> Data? {
        let fileURL = cacheDirectory.appendingPathComponent(cacheKey(for: url))
        if let cached = try? Data(contentsOf: fileURL) {
            return cached
        }

        var request = URLRequest(url: url)
        request.httpShouldHandleCookies = false

        guard
            let (data, response) = try? await session.data(for: request),
            let http = response as? HTTPURLResponse,
            (200 ..< 300).contains(http.statusCode)
        else { return nil }

        try? FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        try? data.write(to: fileURL, options: .atomic)
        return data
    }

    private static func cacheKey(for url: URL) -> String {
        SHA256.hash(data: Data(url.absoluteString.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }
}

// MARK: - Palette

/// The nine colours of a widget tile's mesh, top row first: dark sky above,
/// the curtain's bright lower edge below, exactly where the app's aurora
/// puts its light. The animated Metal fields cannot run in a widget, so the
/// same hues are laid down still.
struct MeshPalette: Equatable {
    let colors: [Color]

    /// The Inbox header card's aurora, from `AuroraShader.metal`.
    static let inbox = MeshPalette(colors: [
        Color(red: 16 / 255, green: 17 / 255, blue: 19 / 255),
        Color(red: 16 / 255, green: 17 / 255, blue: 19 / 255),
        Color(red: 0.10, green: 0.13, blue: 0.30),
        Color(red: 0.10, green: 0.13, blue: 0.30),
        Color(red: 82 / 255, green: 91 / 255, blue: 169 / 255),
        Color(red: 47 / 255, green: 83 / 255, blue: 164 / 255),
        Color(red: 0.70, green: 0.17, blue: 0.56),
        Color(red: 0.95, green: 0.36, blue: 0.66),
        Color(red: 128 / 255, green: 57 / 255, blue: 127 / 255),
    ])

    /// A Folder's tile wears the palette its card wears in the Library, laid
    /// out like the Inbox mesh: the deep tone as the sky, a darkened mid in
    /// the middle so nothing glows there, and the saturated mid along the
    /// foot with the highlight only warming its centre. The card's pastel
    /// highlight never appears on its own: at tile size it read as a white
    /// blot.
    static func folder(_ palette: FolderCardPalette) -> MeshPalette {
        let deep = palette.deep
        let mid = palette.mid
        let sky = deep * 0.45

        return MeshPalette(colors: [
            color(sky), color(sky), color(deep * 0.8),
            color(deep), color(mix(deep, mid, 0.35)), color(mix(deep, mid, 0.2)),
            color(mid), color(mix(mid, palette.highlight, 0.4)), color(mix(mid, deep, 0.45)),
        ])
    }

    /// The same sky for a wide, short tile such as the large header. Two
    /// corrections for the squeezed height: the foot's corners sink back
    /// toward the sky so the light gathers at the centre, the way a
    /// curtain's edge does; and the top row lifts toward the row below it,
    /// because a sky this short reads as a black band, not as night.
    var wide: MeshPalette {
        var wide = colors
        wide[0] = colors[0].mixed(with: colors[3], by: 0.7)
        wide[1] = colors[1].mixed(with: colors[4], by: 0.45)
        wide[2] = colors[2].mixed(with: colors[5], by: 0.5)
        wide[6] = colors[6].mixed(with: colors[3], by: 0.55)
        wide[8] = colors[8].mixed(with: colors[5], by: 0.55)
        return MeshPalette(colors: wide)
    }

    private static func color(_ value: SIMD3<Float>) -> Color {
        Color(red: Double(value.x), green: Double(value.y), blue: Double(value.z))
    }

    private static func mix(_ a: SIMD3<Float>, _ b: SIMD3<Float>, _ t: Float) -> SIMD3<Float> {
        a + (b - a) * t
    }
}

private extension Color {
    func mixed(with other: Color, by amount: Double) -> Color {
        let a = UIColor(self).rgb
        let b = UIColor(other).rgb
        return Color(
            red: a.0 + (b.0 - a.0) * amount,
            green: a.1 + (b.1 - a.1) * amount,
            blue: a.2 + (b.2 - a.2) * amount
        )
    }
}

private extension UIColor {
    var rgb: (Double, Double, Double) {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return (Double(red), Double(green), Double(blue))
    }
}

private struct AuroraTile: View {
    let palette: MeshPalette

    var body: some View {
        GeometryReader { geometry in
            let isWide = geometry.size.width > geometry.size.height * 1.6

            MeshGradient(
                width: 3,
                height: 3,
                points: [
                    [0.0, 0.0], [0.5, 0.0], [1.0, 0.0],
                    [0.0, 0.55], [0.45, 0.5], [1.0, 0.6],
                    [0.0, 1.0], [0.5, 1.0], [1.0, 1.0],
                ],
                colors: (isWide ? palette.wide : palette).colors
            )
        }
    }
}

/// The shared brandmark, drawn from the geometry in `Shared/`.
private struct WidgetBrandmark: Shape {
    func path(in rect: CGRect) -> Path {
        Path(SleevyBrandmarkPath.path(in: rect))
    }
}

// MARK: - Views

struct UnreadWidgetView: View {
    @Environment(\.widgetFamily) private var family

    let entry: UnreadEntry

    var body: some View {
        switch entry.state {
        case .signedOut:
            MessageView(
                title: "No Inbox yet",
                detail: "Open Sleevy and sign in to see your unread saves here.",
                accessoryTitle: "Sign in to Sleevy",
                link: SleevyDeepLink.inbox.url
            )
        case .missingFolder:
            MessageView(
                title: "Folder not found",
                detail: "It may have been deleted. Edit this widget to pick another folder.",
                accessoryTitle: "Folder not found",
                link: SleevyDeepLink.inbox.url
            )
        case .backlog(let scope):
            switch family {
            case .systemSmall:
                SmallView(scope: scope, now: entry.date)
            case .systemLarge, .systemExtraLarge:
                LargeView(scope: scope, now: entry.date)
            case .accessoryCircular:
                CircularView(scope: scope)
            case .accessoryRectangular:
                RectangularView(scope: scope)
            case .accessoryInline:
                InlineView(scope: scope)
            default:
                MediumView(scope: scope, now: entry.date)
            }
        }
    }
}

private struct MessageView: View {
    @Environment(\.widgetFamily) private var family

    let title: String
    let detail: String
    let accessoryTitle: String
    let link: URL

    var body: some View {
        Group {
            if family.isAccessory {
                Text(accessoryTitle)
                    .font(.headline)
                    .containerBackground(for: .widget) { AccessoryWidgetBackground() }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .padding(16)
                .containerBackground(Color(uiColor: .systemBackground), for: .widget)
            }
        }
        .widgetURL(link)
    }
}

/// The small family is the header card itself: the count on the aurora,
/// with the newest title so the number has a face.
private struct SmallView: View {
    let scope: UnreadScope
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScopeLabel(scope: scope)

            Spacer(minLength: 6)

            if scope.count == 0 {
                CaughtUpLabel()
                Spacer(minLength: 0)
            } else {
                CountBlock(count: scope.count, numeralSize: 44)

                Spacer(minLength: 8)

                if let first = scope.rows.first {
                    Text(first.title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.92))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(16)
        .containerBackground(for: .widget) { AuroraTile(palette: scope.palette) }
        .widgetURL(scope.link)
    }
}

/// The medium family turns the header card on its side: the count panel
/// bleeds to the leading edge, the newest rows sit beside it.
private struct MediumView: View {
    let scope: UnreadScope
    let now: Date

    var body: some View {
        HStack(spacing: 0) {
            Link(destination: scope.link) {
                // One block anchored at the bottom — caption, count,
                // "unread" — the way the title sits at the foot of the app's
                // header card. A caption alone at the top read as stranded.
                VStack(alignment: .leading, spacing: 6) {
                    Spacer(minLength: 0)
                    ScopeLabel(scope: scope)
                    if scope.count == 0 {
                        CaughtUpLabel()
                    } else {
                        CountBlock(count: scope.count, numeralSize: 40)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .padding(14)
                .background { AuroraTile(palette: scope.palette) }
            }
            .frame(width: 124)

            RowList(rows: scope.rows, now: now, maximumRows: 3, faviconSize: 26, rowHeight: 44)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
        }
        .containerBackground(Color(uiColor: .systemBackground), for: .widget)
    }
}

/// The large family is the screen in miniature: the header card with its
/// title, the count line under it, then the rows.
private struct LargeView: View {
    let scope: UnreadScope
    let now: Date

    private let headerHeight: CGFloat = 92

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Link(destination: scope.link) {
                ZStack(alignment: .bottomLeading) {
                    AuroraTile(palette: scope.palette)

                    // The mark sits on the title's own vertical axis, like the
                    // account avatar opposite the app's large title, rather
                    // than hanging off its baseline.
                    HStack(alignment: .center, spacing: 8) {
                        Text(scope.title)
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Spacer()
                        WidgetBrandmark()
                            .fill(.white.opacity(0.92))
                            .frame(width: 15, height: 19)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                }
                .frame(height: headerHeight)
                .clipShape(.rect(bottomLeadingRadius: 22, bottomTrailingRadius: 22, style: .continuous))
            }

            Text(scope.count == 0 ? "All caught up" : "\(scope.count) unread")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 2)

            RowList(rows: scope.rows, now: now, maximumRows: 6, faviconSize: 28, rowHeight: 42)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
        }
        .containerBackground(Color(uiColor: .systemBackground), for: .widget)
    }
}

// MARK: - Accessory families

private struct CircularView: View {
    let scope: UnreadScope

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 1) {
                if scope.isInbox {
                    WidgetBrandmark()
                        .fill(.primary)
                        .frame(width: 9, height: 11)
                } else {
                    Image(systemName: "folder.fill")
                        .font(.system(size: 10, weight: .semibold))
                }
                Text(scope.count, format: .number)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
            }
        }
        .containerBackground(for: .widget) { Color.clear }
        .widgetURL(scope.link)
    }
}

private struct RectangularView: View {
    let scope: UnreadScope

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 5) {
                if scope.isInbox {
                    WidgetBrandmark()
                        .fill(.primary)
                        .frame(width: 9, height: 11)
                } else {
                    Image(systemName: "folder.fill")
                        .font(.system(size: 11, weight: .semibold))
                }
                Text(scope.count == 0 ? "\(scope.title): all caught up" : "\(scope.count) unread in \(scope.title)")
                    .font(.headline)
                    .lineLimit(1)
                    .widgetAccentable()
            }
            if let first = scope.rows.first {
                Text(first.title)
                    .font(.system(size: 13))
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { Color.clear }
        .widgetURL(scope.link)
    }
}

private struct InlineView: View {
    let scope: UnreadScope

    var body: some View {
        Label(
            scope.count == 0 ? "\(scope.title): all caught up" : "\(scope.count) unread in \(scope.title)",
            systemImage: scope.isInbox ? "tray" : "folder"
        )
        .containerBackground(for: .widget) { Color.clear }
        .widgetURL(scope.link)
    }
}

// MARK: - Pieces

/// The tile's caption: the scope's name alone — "Inbox" or the Folder name
/// — the way the Library's cards carry theirs. The aurora is the brand
/// here; a mark next to the word only cluttered the small tile.
private struct ScopeLabel: View {
    let scope: UnreadScope

    var body: some View {
        Text(scope.title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white.opacity(0.88))
            // A Folder name can be long and the medium panel is narrow:
            // wrap once before truncating, so "Engineering" stays whole.
            .lineLimit(2)
            .minimumScaleFactor(0.85)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct CountBlock: View {
    let count: Int
    let numeralSize: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: -2) {
            Text(count, format: .number)
                .font(.system(size: numeralSize, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text("unread")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white.opacity(0.72))
        }
    }
}

private struct CaughtUpLabel: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 26, weight: .medium))
                .foregroundStyle(.white)
            Text("All caught up")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white.opacity(0.88))
        }
    }
}

/// The rows, as many whole ones as fit the height. Each is a button running
/// `OpenSavedItemIntent`: the row leaves the widget, the read is queued for
/// the app, and the link opens straight away.
private struct RowList: View {
    let rows: [UnreadRow]
    let now: Date
    let maximumRows: Int
    let faviconSize: CGFloat
    let rowHeight: CGFloat

    var body: some View {
        GeometryReader { geometry in
            let fitting = max(1, Int(geometry.size.height / rowHeight))
            let shown = Array(rows.prefix(min(maximumRows, fitting)))

            if shown.isEmpty {
                Text("Unread saves will appear here.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 0) {
                    ForEach(shown) { row in
                        Button(intent: OpenSavedItemIntent(itemID: row.id, url: row.url)) {
                            RowView(row: row, now: now, faviconSize: faviconSize)
                                .frame(height: rowHeight)
                        }
                        .buttonStyle(.plain)

                        if row.id != shown.last?.id {
                            Divider()
                                .overlay(Color.primary.opacity(0.08))
                        }
                    }
                }
                // Rows start at the top, level with the panel's caption, and
                // leave the slack below when fewer fit than the maximum: a
                // two-row Folder must not float in the middle of the widget.
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
    }
}

private struct RowView: View {
    let row: UnreadRow
    let now: Date
    let faviconSize: CGFloat

    var body: some View {
        HStack(spacing: 10) {
            Favicon(image: row.favicon, monogram: row.monogram, size: faviconSize)

            VStack(alignment: .leading, spacing: 2) {
                Text(row.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(row.host)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text(row.lastSavedAt.compactRecencyLabel(relativeTo: now))
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .contentShape(Rectangle())
    }
}

private struct Favicon: View {
    let image: UIImage?
    let monogram: String
    let size: CGFloat

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: size * 0.72, height: size * 0.72)
            } else {
                Text(monogram)
                    .font(.system(size: size * 0.5, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .background(
            Color(uiColor: .secondarySystemFill),
            in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
        )
    }
}

private extension WidgetFamily {
    var isAccessory: Bool {
        switch self {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            true
        default:
            false
        }
    }
}

private extension Date {
    /// The app rows' recency label — "now", "12m", "3h", then "Aug 12" —
    /// measured from the entry date so each timeline entry reads correctly
    /// at the moment it is shown.
    func compactRecencyLabel(relativeTo now: Date) -> String {
        let interval = max(0, now.timeIntervalSince(self))
        let minutes = Int(interval / 60)

        if minutes < 1 { return "now" }
        if minutes < 60 { return "\(minutes)m" }

        let hours = Int(interval / 3_600)
        if hours < 24 { return "\(hours)h" }

        return Calendar.current.isDate(self, equalTo: now, toGranularity: .year)
            ? Self.sameYearFormatter.string(from: self)
            : Self.crossYearFormatter.string(from: self)
    }

    private static let sameYearFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
        return formatter
    }()

    private static let crossYearFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.setLocalizedDateFormatFromTemplate("MMM d yyyy")
        return formatter
    }()
}

// MARK: - Widget

struct UnreadWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: UnreadBacklogSnapshot.widgetKind,
            intent: UnreadWidgetConfigurationIntent.self,
            provider: UnreadProvider()
        ) { entry in
            UnreadWidgetView(entry: entry)
        }
        .configurationDisplayName("Inbox")
        .description("Your unread saves, newest first, for the whole Inbox or one folder. Tap one to open it.")
        .supportedFamilies([
            .systemSmall, .systemMedium, .systemLarge,
            .accessoryCircular, .accessoryRectangular, .accessoryInline,
        ])
        .contentMarginsDisabled()
    }
}
