import Foundation

/// The article prose of a Saved Item's Link, as Markdown, for the Reader View.
///
/// Read through its own request and never carried in a list response, so this
/// arrives only when someone opens an item (ADR 0021). Only the Markdown form
/// is served; the extractor's HTML stays on the server, which is what keeps the
/// app free of an HTML sanitizer.
nonisolated struct ReadableContent: Codable, Equatable, Sendable {
    let savedItemId: String
    let originalURL: String
    /// The article's own title, which can differ from the Saved Item's — the
    /// extractor reads the page, the Saved Metadata read the tags.
    let title: String?
    let markdown: String
    let extractedAt: Date

    enum CodingKeys: String, CodingKey {
        case savedItemId
        case originalURL = "originalUrl"
        case title
        case markdown
        case extractedAt
    }
}
