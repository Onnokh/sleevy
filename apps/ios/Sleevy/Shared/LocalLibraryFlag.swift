import Foundation

/// Whether this device uses a Local Library: Sleevy with no Account, the
/// Saved Items kept and enriched on the device. The app writes the flag; the
/// share extension reads it, so a share is queued for the Local Library
/// instead of sent to the API with a token that does not exist.
nonisolated enum LocalLibraryFlag {
    private static let key = "local-library.on"

    /// The owner id of the Local Library: the key of its queues and cache.
    static let userId = "local-library"

    static var isOn: Bool {
        get { SleevyUserPreferences.defaults.bool(forKey: key) }
        set { SleevyUserPreferences.defaults.set(newValue, forKey: key) }
    }
}
