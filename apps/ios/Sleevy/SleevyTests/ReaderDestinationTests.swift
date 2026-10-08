import Foundation
import Testing
@testable import Sleevy

/// The rule that decides where the Open Action leads. It has to agree with the
/// Web Companion's `reader-destination.ts` — the same Saved Item must not
/// behave differently depending on which client opened it.
@MainActor
struct ReaderDestinationTests {
    @Test func articleWithReadableContentHasAReaderView() {
        var item = SavedItem.fixture(id: "a", isRead: false)
        item.type = "article"
        item.hasReadableContent = true

        #expect(hasReaderView(item))
    }

    @Test func articleWithoutReadableContentGoesToTheBrowser() {
        var item = SavedItem.fixture(id: "a", isRead: false)
        item.type = "article"
        item.hasReadableContent = false

        #expect(!hasReaderView(item))
    }

    /// Extraction gets nothing from a client-rendered timeline, but capture
    /// already resolved the message, so a Post reads fine without an article.
    @Test func postHasAReaderViewWithoutReadableContent() {
        var item = SavedItem.fixture(id: "p", isRead: false)
        item.type = "post"
        item.hasReadableContent = false

        #expect(hasReaderView(item))
    }

    @Test func readerViewTurnedOffSendsEverythingToTheBrowser() {
        var readable = SavedItem.fixture(id: "a", isRead: false)
        readable.type = "article"
        readable.hasReadableContent = true

        #expect(opensInReader(readable, readerViewDisabled: false))
        #expect(!opensInReader(readable, readerViewDisabled: true))
    }

    /// The flag is additive, so a row cached before the Reader View existed
    /// decodes as one without an article rather than failing the whole list.
    @Test func decodingToleratesAMissingFlag() throws {
        let json = """
        {
          "id": "a", "originalUrl": "https://example.com", "normalizedUrl": "https://example.com",
          "host": "example.com", "type": "article", "tags": [], "enrichmentStatus": "enriched",
          "isRead": false, "lastSavedAt": "1970-01-01T00:00:00Z",
          "createdAt": "1970-01-01T00:00:00Z", "updatedAt": "1970-01-01T00:00:00Z"
        }
        """

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let item = try decoder.decode(SavedItem.self, from: Data(json.utf8))

        #expect(!item.hasReadableContent)
        #expect(!hasReaderView(item))
    }
}
