import SwiftUI

@MainActor
@Observable
final class AppSettings {
    var themePreference: SleevyThemePreference {
        didSet {
            SleevyUserPreferences.defaults.set(themePreference.rawValue, forKey: SleevyUserPreferences.themeKey)
        }
    }

    var sourceName: String {
        didSet {
            SleevyUserPreferences.defaults.set(sourceName, forKey: SleevyUserPreferences.sourceNameKey)
        }
    }

    /// Whether this reader has turned the Reader View off. Off by default, so a
    /// Saved Item opens into the Reader View unless someone says otherwise.
    ///
    /// Per device rather than per Account, matching the Web Companion: it says
    /// how this person likes to read *here*, and the app is one of several
    /// clients.
    var isReaderViewDisabled: Bool {
        didSet {
            if isReaderViewDisabled {
                SleevyUserPreferences.defaults.set(true, forKey: SleevyUserPreferences.readerViewDisabledKey)
            } else {
                // Absent rather than `false`, so a stored value only ever means
                // the setting was changed from its default.
                SleevyUserPreferences.defaults.removeObject(forKey: SleevyUserPreferences.readerViewDisabledKey)
            }
        }
    }

    init() {
        let storedTheme = SleevyUserPreferences.defaults.string(forKey: SleevyUserPreferences.themeKey)
        self.themePreference = SleevyThemePreference(rawValue: storedTheme ?? "") ?? .system
        self.sourceName = SleevyUserPreferences.sourceName
        self.isReaderViewDisabled = SleevyUserPreferences.defaults.bool(forKey: SleevyUserPreferences.readerViewDisabledKey)
    }

    var preferredColorScheme: ColorScheme? {
        switch themePreference {
        case .system:
            nil
        case .light:
            .light
        case .dark:
            .dark
        }
    }

    func normalizeSourceName() {
        let trimmedValue = sourceName.trimmingCharacters(in: .whitespacesAndNewlines)
        sourceName = trimmedValue.isEmpty ? SleevyUserPreferences.defaultSourceName : trimmedValue
    }

    func resetSourceName() {
        sourceName = SleevyUserPreferences.defaultSourceName
    }
}
