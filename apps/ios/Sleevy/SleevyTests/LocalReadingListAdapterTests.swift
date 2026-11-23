import Foundation
import Testing
@testable import Sleevy

/// The Local Library: the reading-list verbs with no Account, kept in one
/// file and enriched on the device.
@MainActor
struct LocalReadingListAdapterTests {
    private func makeFileURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("local-library-\(UUID().uuidString)")
            .appendingPathComponent("library.json")
    }

    private static let page = PageEnrichment(
        title: "Swift 6.2 Released",
        description: "We are excited to announce Swift 6.2. It makes every developer more productive. And more.",
        siteName: "Swift.org",
        faviconURL: "https://www.swift.org/favicon.ico",
        readableMarkdown: String(repeating: "Prose. ", count: 120),
        summary: nil,
        tags: []
    )

    /// Waits until the enrichment of the first save has finished.
    private func enriched(_ adapter: LocalReadingListAdapter) async throws -> SavedItem {
        for _ in 0..<100 {
            let items = try await adapter.loadSavedItems(.completeLibrary)
            if let item = items.first, item.enrichmentStatus != .pending { return item }
            try await Task.sleep(for: .milliseconds(20))
        }
        Issue.record("the enrichment did not finish")
        return try await adapter.loadSavedItems(.completeLibrary)[0]
    }

    @Test func aCaptureIsEnrichedOnTheDevice() async throws {
        let adapter = LocalReadingListAdapter(fileURL: makeFileURL()) { _ in Self.page }
        let saved = try await adapter.capture(url: "https://www.swift.org/blog/swift-6.2/", sourceName: nil, captureChannel: "ios-app")
        #expect(saved.enrichmentStatus == .pending)
        #expect(saved.host == "swift.org")

        let item = try await enriched(adapter)
        #expect(item.title == "Swift 6.2 Released")
        #expect(item.enrichmentStatus == .enriched)
        #expect(item.hasReadableContent)
        // No model: the page description, at most two sentences, is the summary.
        #expect(item.previewSummary == "We are excited to announce Swift 6.2. It makes every developer more productive.")
        let content = try await adapter.readableContent(itemId: item.id)
        #expect(content.markdown.hasPrefix("Prose."))
    }

    @Test func aPageThatCannotBeFetchedFailsItsEnrichment() async throws {
        let adapter = LocalReadingListAdapter(fileURL: makeFileURL()) { _ in nil }
        _ = try await adapter.capture(url: "https://example.com/gone", sourceName: nil, captureChannel: nil)
        let item = try await enriched(adapter)
        #expect(item.enrichmentStatus == .failed)
    }

    @Test func theSameLinkSavedTwiceIsOneSaveAgainUnread() async throws {
        let adapter = LocalReadingListAdapter(fileURL: makeFileURL()) { _ in Self.page }
        let first = try await adapter.capture(url: "https://example.com/a?utm_source=x#top", sourceName: nil, captureChannel: nil)
        _ = try await adapter.setReadState(itemId: first.id, isRead: true)
        let second = try await adapter.capture(url: "https://EXAMPLE.com/a", sourceName: nil, captureChannel: nil)

        #expect(second.id == first.id)
        #expect(second.isRead == false)
        #expect(try await adapter.loadSavedItems(.completeLibrary).count == 1)
    }

    @Test func notAWebLinkIsRefused() async throws {
        let adapter = LocalReadingListAdapter(fileURL: makeFileURL()) { _ in nil }
        await #expect(throws: SyncFault.self) {
            _ = try await adapter.capture(url: "mailto:someone@example.com", sourceName: nil, captureChannel: nil)
        }
    }

    @Test func theLibraryIsKeptOnDisk() async throws {
        let fileURL = makeFileURL()
        let adapter = LocalReadingListAdapter(fileURL: fileURL) { _ in Self.page }
        let folder = try await adapter.createFolder(name: "Swift", emoji: "🦅", color: "orange")
        let saved = try await adapter.capture(url: "https://www.swift.org/", sourceName: nil, captureChannel: nil)
        _ = try await enriched(adapter)
        _ = try await adapter.moveItem(id: saved.id, toFolder: folder.id)

        let reopened = LocalReadingListAdapter(fileURL: fileURL) { _ in nil }
        #expect(try await reopened.loadFolders() == [folder])
        let items = try await reopened.loadSavedItems(.folder(folder.id))
        #expect(items.map(\.id) == [saved.id])
        #expect(items.first?.title == "Swift 6.2 Released")
        #expect(try await reopened.loadSavedItems(.libraryRoot).isEmpty)
    }

    @Test func deletingAFolderLeavesItsSavesUnfiled() async throws {
        let adapter = LocalReadingListAdapter(fileURL: makeFileURL()) { _ in nil }
        let folder = try await adapter.createFolder(name: "Later", emoji: nil, color: nil)
        let saved = try await adapter.capture(url: "https://example.com/", sourceName: nil, captureChannel: nil)
        _ = try await adapter.moveItem(id: saved.id, toFolder: folder.id)
        try await adapter.deleteFolder(id: folder.id)

        #expect(try await adapter.loadFolders().isEmpty)
        #expect(try await adapter.loadSavedItems(.libraryRoot).map(\.id) == [saved.id])
    }

    @Test func publishingAFolderNeedsAnAccount() async throws {
        let adapter = LocalReadingListAdapter(fileURL: makeFileURL()) { _ in nil }
        let folder = try await adapter.createFolder(name: "Public", emoji: nil, color: nil)
        await #expect(throws: SyncFault.self) {
            _ = try await adapter.setFolderPublished(id: folder.id, isPublished: true)
        }
    }

    @Test func eraseRemovesTheLibrary() async throws {
        let fileURL = makeFileURL()
        let adapter = LocalReadingListAdapter(fileURL: fileURL) { _ in nil }
        _ = try await adapter.capture(url: "https://example.com/", sourceName: nil, captureChannel: nil)
        adapter.erase()

        #expect(adapter.snapshot.items.isEmpty)
        #expect(FileManager.default.fileExists(atPath: fileURL.path) == false)
    }
}

/// The body of the import into an Account, as the API's schema reads it.
struct LocalLibraryImportTests {
    private static func item(_ n: Int) -> SavedItem {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        return SavedItem(
            id: "local-\(n)", originalURL: "https://example.com/\(n)", normalizedURL: "https://example.com/\(n)",
            host: "example.com", title: nil, description: nil, siteName: nil, faviconURL: nil,
            faviconLightURL: nil, faviconDarkURL: nil, canonicalURL: nil, previewSummary: nil, type: "article",
            tags: ["ai"], enrichmentStatus: .enriched, sourceName: nil, captureChannel: nil, folder: nil,
            isRead: true, lastSavedAt: now, createdAt: now, updatedAt: now
        )
    }

    @Test func emptyFieldsAreSentAsNull() throws {
        let body = LocalLibraryImport(
            folders: [.init(name: "Later", emoji: nil, color: nil)],
            items: [.init(Self.item(1))]
        )
        let json = try #require(String(data: JSONEncoder().encode(body), encoding: .utf8))
        #expect(json.contains(#""title":null"#))
        #expect(json.contains(#""folderName":null"#))
        #expect(json.contains(#""emoji":null"#))
        #expect(json.contains(#""savedAt":"2027-01-15T08:00:00Z""#))
        #expect(json.contains(#""isRead":true"#))
    }

    @Test func foldersGoFirstAndRequestsStayInsideTheLimits() {
        let folders = (0..<120).map { LocalLibraryImport.Folder(name: "F\($0)", emoji: nil, color: nil) }
        let items = (0..<1_201).map { LocalLibraryImport.Item(Self.item($0)) }
        let requests = LocalLibraryImport.requests(folders: folders, items: items)

        #expect(requests.map(\.folders.count) == [50, 50, 20, 0, 0, 0])
        #expect(requests.map(\.items.count) == [0, 0, 0, 500, 500, 201])
    }
}
