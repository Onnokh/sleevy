import Foundation

/// The Unread Backlog as the Unread Widget sees it, published by the app
/// into the app group each time the Inbox or the Folder list changes: the
/// whole backlog, each Folder's share of it, the Library's newest Saved
/// Items read or unread, and the Folder list the widget configuration sheet
/// offers.
///
/// The widget holds no credentials and calls no endpoint. It renders the last
/// state the app published, and the app asks WidgetKit to reload it right
/// after every publish, so the widget follows the Inbox without a network
/// path of its own (ADR 0020).
nonisolated struct UnreadBacklogSnapshot: Codable, Equatable, Sendable {
    struct Item: Codable, Equatable, Identifiable, Sendable {
        let id: String
        let title: String
        let host: String
        let faviconURL: URL?
        /// The Original URL a row tap opens.
        let url: URL
        let lastSavedAt: Date
        /// Always false in an unread scope; the Library scope carries both
        /// states and draws the Unread Dot from it.
        let isRead: Bool

        func read() -> Item {
            Item(id: id, title: title, host: host, faviconURL: faviconURL, url: url, lastSavedAt: lastSavedAt, isRead: true)
        }
    }

    struct Folder: Codable, Equatable, Identifiable, Sendable {
        let id: String
        let name: String
        let emoji: String?
        let color: String?
    }

    /// One scope: how many Saved Items it holds, and the newest of them,
    /// most recently saved first. The Inbox and a Folder count and list
    /// unread items only; the Library counts and lists every Saved Item.
    struct Scope: Codable, Equatable, Sendable {
        let count: Int
        let items: [Item]

        static let empty = Scope(count: 0, items: [])
    }

    /// The widget kind the app reloads after a publish.
    static let widgetKind = "UnreadWidget"
    /// The large family shows the most rows; nothing beyond that is stored
    /// per scope.
    static let maximumItems = 8

    /// The Account the backlog belongs to; keys the read-state queue a widget
    /// tap writes into.
    let accountID: String
    let inbox: Scope
    /// The whole collection, newest first, read and unread alike.
    let library: Scope
    let folders: [Folder]
    /// Each Folder's share of the backlog, keyed by Folder identifier.
    let folderScopes: [String: Scope]
    let publishedAt: Date

    private static let key = "widget.unread-backlog"

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    static func load() -> UnreadBacklogSnapshot? {
        guard let data = SleevyUserPreferences.defaults.data(forKey: key) else { return nil }
        return try? decoder.decode(UnreadBacklogSnapshot.self, from: data)
    }

    func save() {
        guard let data = try? Self.encoder.encode(self) else { return }
        SleevyUserPreferences.defaults.set(data, forKey: Self.key)
    }

    static func clear() {
        SleevyUserPreferences.defaults.removeObject(forKey: key)
    }

    /// Whether both describe the same backlog, whenever they were published.
    func hasSameContent(as other: UnreadBacklogSnapshot?) -> Bool {
        guard let other else { return false }
        return accountID == other.accountID
            && inbox == other.inbox
            && library == other.library
            && folders == other.folders
            && folderScopes == other.folderScopes
    }

    /// The snapshot after one Saved Item was read from a widget. The row
    /// leaves every unread scope that listed it and those counts drop by
    /// one; in the Library, which shows read items too, it stays and turns
    /// read. The Inbox count always drops, because every unread item is in
    /// the Inbox; a Folder count only drops when the item was among its
    /// listed rows, which is the only way it could have been tapped there.
    /// The app's next publish replaces this estimate with the real state.
    func markingRead(itemID: String) -> UnreadBacklogSnapshot {
        UnreadBacklogSnapshot(
            accountID: accountID,
            inbox: inbox.removing(itemID: itemID, alwaysCounted: true),
            library: library.markingRead(itemID: itemID),
            folders: folders,
            folderScopes: folderScopes.mapValues { $0.removing(itemID: itemID, alwaysCounted: false) },
            publishedAt: Date()
        )
    }
}

nonisolated extension UnreadBacklogSnapshot.Scope {
    func removing(itemID: String, alwaysCounted: Bool) -> Self {
        let wasListed = items.contains { $0.id == itemID }
        guard wasListed || alwaysCounted else { return self }
        return Self(
            count: max(0, count - 1),
            items: items.filter { $0.id != itemID }
        )
    }

    func markingRead(itemID: String) -> Self {
        Self(count: count, items: items.map { $0.id == itemID ? $0.read() : $0 })
    }
}
