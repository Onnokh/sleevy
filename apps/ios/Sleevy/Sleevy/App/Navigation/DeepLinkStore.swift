import Observation

/// The one `sleevy://` URL waiting to be handled. `SleevyApp` receives every
/// URL, but only the signed-in shell can act on one. Parking it here lets a
/// URL that arrives before the session is restored be handled once it is.
@MainActor
@Observable
final class DeepLinkStore {
    var pending: SleevyDeepLink?
}
