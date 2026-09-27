import SwiftUI

extension EnvironmentValues {
    /// The Open Action, as one call every list can make: it decides whether
    /// this Saved Item opens in the Reader View or in the browser, and records
    /// the Open either way.
    ///
    /// One entry point rather than a decision at each of the six places a row
    /// can be tapped — the Inbox, a Folder, the Library, Search, and a widget
    /// deep link would otherwise each need to remember the rule, and they would
    /// drift. Mirrors `useOpenSavedItem` in the Web Companion.
    ///
    /// The default sends everything to the browser, which is what a preview or
    /// a stack without a Reader destination should do.
    @Entry var openSavedItem: @MainActor (SavedItem) async -> Void = { _ in }
}
