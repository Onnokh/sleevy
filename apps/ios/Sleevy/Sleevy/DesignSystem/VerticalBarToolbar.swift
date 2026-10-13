import SwiftUI

extension View {
    /// Adds toolbar items that go in the vertical bar, where the device has
    /// one: the iPhone Duo's system rail. Before iOS 27.1, or with `isEnabled`
    /// off, nothing is added.
    func verticalBarToolbar<Items: ToolbarContent>(
        isEnabled: Bool,
        @ToolbarContentBuilder items: () -> Items
    ) -> some View {
        modifier(VerticalBarToolbar(isEnabled: isEnabled, items: items()))
    }
}

private struct VerticalBarToolbar<Items: ToolbarContent>: ViewModifier {
    let isEnabled: Bool
    let items: Items

    func body(content: Content) -> some View {
        // `axisBehavior` is only in the iOS 27.1 SDK (SwiftUI 8.0.85). Xcode
        // Cloud's "Latest Release" still builds with the iOS 27.0 SDK.
        #if canImport(SwiftUI, _version: 8.0.85)
        if #available(iOS 27.1, *) {
            content.toolbar {
                if isEnabled {
                    items.axisBehavior(.verticalPreferred)
                }
            }
        } else {
            content
        }
        #else
        content
        #endif
    }
}
