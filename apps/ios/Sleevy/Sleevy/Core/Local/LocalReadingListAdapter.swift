import Foundation

/// The reading-list verbs for a Local Library: Sleevy with no Account. The
/// Saved Items, Folders and Readable Content live in one file in the app
/// group, and each save is enriched on the device (`LocalEnricher`). The
/// store talks to it exactly as it talks to the API, through
/// `ReadingListNetworkPort`.
@MainActor
final class LocalReadingListAdapter: ReadingListNetworkPort {
    /// Called when the library changed by itself, as when an enrichment
    /// finished, so the store can load it again.
    var onChange: (() -> Void)?

    private var library: LocalLibraryFile
    private var enriching: Set<String> = []
    private let fileURL: URL?
    private let enrich: @Sendable (URL) async -> PageEnrichment?
    private let pickFolder: @Sendable (PageEnrichment, [String]) async -> String?

    init(
        fileURL: URL? = LocalLibraryFile.defaultURL,
        enrich: @escaping @Sendable (URL) async -> PageEnrichment? = { await LocalEnricher.enrich(url: $0) },
        pickFolder: @escaping @Sendable (PageEnrichment, [String]) async -> String? = { await LocalEnricher.folder(for: $0, from: $1) }
    ) {
        self.fileURL = fileURL
        self.enrich = enrich
        self.pickFolder = pickFolder
        self.library = fileURL.flatMap(LocalLibraryFile.load) ?? LocalLibraryFile()
        // Enrichments the app did not finish before it was closed.
        for item in library.items where item.enrichmentStatus == .pending {
            startEnrichment(of: item.id)
        }
    }

    /// Everything in the Local Library, for the import into an Account.
    var snapshot: LocalLibraryFile { library }

    // MARK: Reading

    func loadSavedItems(_ request: SavedItemFetchRequest) async throws(SyncFault) -> [SavedItem] {
        let items: [SavedItem]
        switch request {
        case .completeLibrary: items = library.items
        case .libraryRoot: items = library.items.filter { $0.folder == nil }
        case .folder(let id): items = library.items.filter { $0.folder?.id == id }
        }
        return items.sorted { $0.lastSavedAt > $1.lastSavedAt }
    }

    func loadFolders() async throws(SyncFault) -> [Folder] {
        library.folders
    }

    func readableContent(itemId: String) async throws(SyncFault) -> ReadableContent {
        guard let content = library.contents[itemId] else {
            throw SyncFault.permanent(reason: "This page has no text Sleevy could read.")
        }
        return content
    }

    // MARK: Saving

    func capture(url: String, sourceName: String?, captureChannel: String?) async throws(SyncFault) -> SavedItem {
        guard let parsed = URL(string: url.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = parsed.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = parsed.host
        else {
            throw SyncFault.permanent(reason: "That is not a web link.")
        }
        let normalized = Self.normalize(parsed)
        let now = Date()

        // Saved again: back to the top, unread, as the API does.
        if let index = library.items.firstIndex(where: { $0.normalizedURL == normalized }) {
            library.items[index].lastSavedAt = now
            library.items[index].updatedAt = now
            library.items[index].isRead = false
            persist()
            return library.items[index]
        }

        let bareHost = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        let item = SavedItem(
            id: "local-\(UUID().uuidString.lowercased())",
            originalURL: parsed.absoluteString,
            normalizedURL: normalized,
            host: bareHost,
            title: nil,
            description: nil,
            siteName: nil,
            faviconURL: nil,
            faviconLightURL: nil,
            faviconDarkURL: nil,
            canonicalURL: nil,
            previewSummary: nil,
            type: "article",
            tags: [],
            enrichmentStatus: .pending,
            sourceName: sourceName,
            captureChannel: captureChannel,
            folder: nil,
            isRead: false,
            lastSavedAt: now,
            createdAt: now,
            updatedAt: now
        )
        library.items.append(item)
        persist()
        startEnrichment(of: item.id)
        return item
    }

    func setReadState(itemId: String, isRead: Bool) async throws(SyncFault) -> SavedItem {
        try update(itemId) { $0.isRead = isRead }
    }

    func markOpened(itemId: String) async throws(SyncFault) -> SavedItem {
        try update(itemId) { $0.isRead = true }
    }

    func deleteItem(itemId: String) async throws(SyncFault) {
        library.items.removeAll { $0.id == itemId }
        library.contents[itemId] = nil
        persist()
    }

    func moveItem(id: String, toFolder folderId: String?) async throws(SyncFault) -> SavedItem {
        let folder = folderId.flatMap { id in library.folders.first { $0.id == id } }
        if folderId != nil, folder == nil {
            throw SyncFault.permanent(reason: "That Folder does not exist.")
        }
        return try update(id) { item in
            item.folder = folder.map { FolderSummary(id: $0.id, name: $0.name, emoji: $0.emoji, color: $0.color) }
        }
    }

    // MARK: Folders

    func createFolder(name: String, emoji: String?, color: String?) async throws(SyncFault) -> Folder {
        let folder = Folder(id: "local-\(UUID().uuidString.lowercased())", name: name, emoji: emoji, color: color)
        library.folders.append(folder)
        persist()
        return folder
    }

    func renameFolder(id: String, name: String, emoji: String?, color: String?) async throws(SyncFault) -> Folder {
        guard let index = library.folders.firstIndex(where: { $0.id == id }) else {
            throw SyncFault.permanent(reason: "That Folder does not exist.")
        }
        let folder = Folder(id: id, name: name, emoji: emoji, color: color)
        library.folders[index] = folder
        let summary = FolderSummary(id: id, name: name, emoji: emoji, color: color)
        for item in library.items.indices where library.items[item].folder?.id == id {
            library.items[item].folder = summary
        }
        persist()
        return folder
    }

    func setFolderPublished(id: String, isPublished: Bool) async throws(SyncFault) -> Folder {
        throw SyncFault.permanent(reason: "Publishing a Folder needs an Account.")
    }

    func deleteFolder(id: String) async throws(SyncFault) {
        library.folders.removeAll { $0.id == id }
        for item in library.items.indices where library.items[item].folder?.id == id {
            library.items[item].folder = nil
        }
        persist()
    }

    // MARK: Erase

    /// Removes the Local Library from the device, after an import into an
    /// Account.
    func erase() {
        library = LocalLibraryFile()
        if let fileURL { try? FileManager.default.removeItem(at: fileURL) }
    }

    // MARK: Private

    private func update(_ id: String, _ change: (inout SavedItem) -> Void) throws(SyncFault) -> SavedItem {
        guard let index = library.items.firstIndex(where: { $0.id == id }) else {
            throw SyncFault.permanent(reason: "That save is no longer in the library.")
        }
        change(&library.items[index])
        library.items[index].updatedAt = Date()
        persist()
        return library.items[index]
    }

    private func startEnrichment(of id: String) {
        guard !enriching.contains(id),
              let item = library.items.first(where: { $0.id == id }),
              let url = URL(string: item.originalURL)
        else { return }
        enriching.insert(id)
        let enrich = self.enrich
        let pickFolder = self.pickFolder
        Task { [weak self] in
            let page = await enrich(url)
            // Auto-Filing: only a save that arrived without a Folder.
            var folderName: String?
            if let page, let names = self?.unfiledFolderNames(for: id) {
                folderName = await pickFolder(page, names)
            }
            self?.finishEnrichment(of: id, with: page, folderName: folderName)
        }
    }

    /// The Folder names to file a save into, or nil when the save already
    /// has a Folder or there is none.
    private func unfiledFolderNames(for id: String) -> [String]? {
        guard library.items.first(where: { $0.id == id })?.folder == nil, !library.folders.isEmpty else { return nil }
        return library.folders.map(\.name)
    }

    private func finishEnrichment(of id: String, with page: PageEnrichment?, folderName: String? = nil) {
        enriching.remove(id)
        guard let index = library.items.firstIndex(where: { $0.id == id }) else { return }
        var item = library.items[index]
        if let page {
            item.title = page.title ?? item.title
            item.description = page.description
            item.siteName = page.siteName
            item.faviconURL = page.faviconURL
            // The page's own description stands in for a summary where the
            // device has no model to write one.
            item.previewSummary = page.summary ?? page.description.map(Self.shortened)
            item.tags = page.tags
            if let markdown = page.readableMarkdown {
                item.hasReadableContent = true
                library.contents[id] = ReadableContent(
                    savedItemId: id,
                    originalURL: item.originalURL,
                    title: page.title,
                    markdown: markdown,
                    extractedAt: Date()
                )
            }
            if item.folder == nil, let folderName,
               let folder = library.folders.first(where: { $0.name == folderName }) {
                item.folder = FolderSummary(id: folder.id, name: folder.name, emoji: folder.emoji, color: folder.color)
            }
            item.enrichmentStatus = .enriched
        } else {
            item.enrichmentStatus = .failed
        }
        item.updatedAt = Date()
        library.items[index] = item
        persist()
        onChange?()
    }

    private func persist() {
        guard let fileURL else { return }
        library.save(to: fileURL)
    }

    /// A page description as a Preview Summary: at most two sentences.
    static func shortened(_ text: String) -> String {
        var sentences: [Substring] = []
        text.enumerateSubstrings(in: text.startIndex..., options: .bySentences) { sentence, _, _, stop in
            if let sentence { sentences.append(Substring(sentence)) }
            if sentences.count == 2 { stop = true }
        }
        let short = sentences.joined().trimmingCharacters(in: .whitespacesAndNewlines)
        return short.isEmpty ? text : short
    }

    /// The same link saved twice is one save: no fragment, no tracking
    /// parameters, a lowercase host, no trailing slash.
    static func normalize(_ url: URL) -> String {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url.absoluteString
        }
        components.fragment = nil
        components.scheme = components.scheme?.lowercased()
        components.host = components.host?.lowercased()
        components.queryItems = components.queryItems?.filter {
            !$0.name.lowercased().hasPrefix("utm_") && !["fbclid", "gclid", "ref"].contains($0.name.lowercased())
        }
        if components.queryItems?.isEmpty == true { components.queryItems = nil }
        var value = components.string ?? url.absoluteString
        if value.hasSuffix("/") && components.path != "/" { value.removeLast() }
        return value
    }
}

/// The Local Library on disk: one JSON file in the app group.
nonisolated struct LocalLibraryFile: Codable, Sendable {
    var items: [SavedItem] = []
    var folders: [Folder] = []
    var contents: [String: ReadableContent] = [:]

    static var defaultURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: AppConfig.appGroupIdentifier)?
            .appendingPathComponent("LocalLibrary", isDirectory: true)
            .appendingPathComponent("library.json")
    }

    static func load(from url: URL) -> LocalLibraryFile? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .sleevyISO8601
        return try? decoder.decode(LocalLibraryFile.self, from: data)
    }

    func save(to url: URL) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(self) else { return }
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }
}
