import Foundation

/// A `sleevy://` URL a widget hands to the app. Four destinations: the
/// Inbox, the Library, one Folder View, and one Saved Item, which the app
/// opens through the Open Action exactly as if its Inbox row had been tapped.
nonisolated enum SleevyDeepLink: Hashable, Sendable {
    case inbox
    case library
    case folder(id: String)
    case savedItem(id: String)

    static let scheme = "sleevy"

    var url: URL {
        var components = URLComponents()
        components.scheme = Self.scheme

        switch self {
        case .inbox:
            components.host = "inbox"
        case .library:
            components.host = "library"
        case .folder(let id):
            components.host = "folders"
            components.path = "/\(id)"
        case .savedItem(let id):
            components.host = "saved-items"
            components.path = "/\(id)"
        }

        return components.url!
    }

    init?(url: URL) {
        guard url.scheme?.lowercased() == Self.scheme else { return nil }

        let segments = url.pathComponents.filter { $0 != "/" }

        switch (url.host()?.lowercased(), segments.count) {
        case ("inbox", 0):
            self = .inbox
        case ("library", 0):
            self = .library
        case ("folders", 1):
            self = .folder(id: segments[0])
        case ("saved-items", 1):
            self = .savedItem(id: segments[0])
        default:
            return nil
        }
    }
}
