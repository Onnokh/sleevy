import Foundation

/// The Unread Backlog as the Unread Widget sees it, published by the app
/// into the app group each time the Inbox or the Folder list changes: the
/// whole backlog, each Folder's share of it, and the Folder list the widget
/// configuration sheet offers.
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
    }

    struct Folder: Codable, Equatable, Identifiable, Sendable {
        let id: String
        let name: String
        let emoji: String?
        let color: String?
    }

    /// One unread scope: how many Saved Items are unread in it, and the
    /// newest of them, most recently saved first.
    struct Scope: Codable, Equatable, Sendable {
        let unreadCount: Int
        let items: [Item]

        static let empty = Scope(unreadCount: 0, items: [])
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
            && folders == other.folders
            && folderScopes == other.folderScopes
    }

    /// The snapshot after one Saved Item was read from a widget: the row
    /// leaves every scope that listed it and those counts drop by one. The
    /// Inbox count always drops, because every unread item is in the Inbox;
    /// a Folder count only drops when the item was among its listed rows,
    /// which is the only way it could have been tapped there. The app's next
    /// publish replaces this estimate with the real counts.
    func removing(itemID: String) -> UnreadBacklogSnapshot {
        UnreadBacklogSnapshot(
            accountID: accountID,
            inbox: inbox.removing(itemID: itemID, alwaysCounted: true),
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
            unreadCount: max(0, unreadCount - 1),
            items: items.filter { $0.id != itemID }
        )
    }
}
