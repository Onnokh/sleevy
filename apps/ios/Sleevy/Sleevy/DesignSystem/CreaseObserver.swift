import SwiftUI

extension View {
    /// Calls `action` with whether the device is creased: a foldable's hinge
    /// partly open, the way a book is held. Folded shut or opened flat both
    /// report false, as does a device without a hinge.
    ///
    /// iOS 27.1 is the first to report a hinge. Before it this never calls
    /// `action`, so a caller's starting value is its layout there.
    func onCreaseChange(_ action: @escaping (Bool) -> Void) -> some View {
        modifier(CreaseObserver(action: action))
    }
}

private struct CreaseObserver: ViewModifier {
    let action: (Bool) -> Void

    func body(content: Content) -> some View {
        // `onHingeChange` is only in the iOS 27.1 SDK (SwiftUI 8.0.85). Xcode
        // Cloud's "Latest Release" still builds with the iOS 27.0 SDK.
        #if canImport(SwiftUI, _version: 8.0.85)
        if #available(iOS 27.1, *) {
            content.onHingeChange { _, context in
                action(context.hinge?.status == .partiallyOpen)
            }
        } else {
            content
        }
        #else
        content
        #endif
    }
}
