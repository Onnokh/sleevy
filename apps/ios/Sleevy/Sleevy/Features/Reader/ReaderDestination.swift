import Foundation

/// Whether this Saved Item has a Reader View at all.
///
/// Two things earn one. Readable Content is the obvious one. A Post is the
/// other: extraction gets nothing from a client-rendered timeline, but capture
/// already resolved the Link Author and the message, so a Post is its own
/// preview and reads fine without an article.
///
/// Mirrors `hasReaderView` in the Web Companion; the two clients must agree on
/// what is readable or the same item behaves differently depending on where it
/// was opened.
nonisolated func hasReaderView(_ item: SavedItem) -> Bool {
    item.hasReadableContent || item.type == "post"
}

/// Whether the Open Action leads into the Reader View for this reader, rather
/// than out to the Original URL.
///
/// Not the same question as ``hasReaderView(_:)``: a reader who has turned the
/// Reader View off sends every Saved Item to its Original URL, whether or not
/// one could have been read here.
nonisolated func opensInReader(_ item: SavedItem, readerViewDisabled: Bool) -> Bool {
    !readerViewDisabled && hasReaderView(item)
}
