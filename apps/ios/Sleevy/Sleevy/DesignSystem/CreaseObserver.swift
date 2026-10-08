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
        if #available(iOS 27.1, *) {
            content.onHingeChange { _, context in
                action(context.hinge?.status == .partiallyOpen)
            }
        } else {
            content
        }
    }
}
