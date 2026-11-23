import Foundation

/// Carries marketing-capture mode across the process boundary into the share
/// extension.
///
/// `SLEEVY_DEMO_MODE` reaches the app as a launch environment variable, but the
/// share extension is launched by the host app being shared from (Safari), so
/// it never sees that variable. The app mirrors the flag into the shared app
/// group at launch and the extension reads it here, which lets a screenshot run
/// capture the real share sheet without a real session behind it.
///
/// The app writes `false` on every non-demo launch, so a normal build can never
/// inherit a stale demo flag from an earlier capture run.
nonisolated enum DemoCaptureFlag {
    private static let key = "demo.capture-mode"

    static var isOn: Bool {
        get { SleevyUserPreferences.defaults.bool(forKey: key) }
        set { SleevyUserPreferences.defaults.set(newValue, forKey: key) }
    }

    /// The demo Account, so a share in a first-run demo lands in its
    /// Pending Captures and reaches the demo Library like a real share.
    static var userId: String? {
        get { SleevyUserPreferences.defaults.string(forKey: "demo.capture-user") }
        set { SleevyUserPreferences.defaults.set(newValue, forKey: "demo.capture-user") }
    }

    /// Whether the success state stays on screen for a screenshot run. A
    /// first-run demo closes the sheet at once, as a real share does.
    static var holdsSuccess: Bool {
        get { SleevyUserPreferences.defaults.bool(forKey: "demo.capture-hold") }
        set { SleevyUserPreferences.defaults.set(newValue, forKey: "demo.capture-hold") }
    }
}
