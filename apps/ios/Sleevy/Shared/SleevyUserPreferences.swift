import Foundation
import UIKit

enum SleevyThemePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system:
            "System"
        case .light:
            "Light"
        case .dark:
            "Dark"
        }
    }
}

enum SleevyUserPreferences {
    /// The app group the app, the share extension and the widgets share. The
    /// Dev Variant uses its own group, so it is read from Info.plist
    /// (`SleevyAppGroupIdentifier`, set from the `SLEEVY_APP_GROUP` build setting).
    nonisolated static let appGroupIdentifier =
        Bundle.main.object(forInfoDictionaryKey: "SleevyAppGroupIdentifier") as? String ?? "group.app.sleevy"
    static let themeKey = "settings.theme"
    static let sourceNameKey = "settings.source-name"
    static let readerViewDisabledKey = "settings.reader-view-disabled"
    static let profileHandleKey = "profile.handle"

    /// `UserDefaults` is thread-safe by contract but not annotated `Sendable`,
    /// so the widget's timeline provider and the share extension read it
    /// from nonisolated code through this explicit opt-out.
    nonisolated(unsafe) static let defaults = UserDefaults(suiteName: appGroupIdentifier) ?? .standard

    /// The signed-in account's profile handle. The app writes it after a
    /// session is established (the session payload itself has no handle) and
    /// clears it on sign-out; the widgets read it to key the public activity
    /// endpoint without their own credentials.
    static var profileHandle: String? {
        get {
            let value = defaults.string(forKey: profileHandleKey)?
                .trimmingCharacters(in: .whitespacesAndNewlines)

            guard let value, !value.isEmpty else { return nil }

            return value
        }
        set {
            if let newValue, !newValue.isEmpty {
                defaults.set(newValue, forKey: profileHandleKey)
            } else {
                defaults.removeObject(forKey: profileHandleKey)
            }
        }
    }

    static var defaultSourceName: String {
        UIDevice.current.name
    }

    static var sourceName: String {
        let storedValue = defaults.string(forKey: sourceNameKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let storedValue, !storedValue.isEmpty else {
            return defaultSourceName
        }

        return storedValue
    }
}
