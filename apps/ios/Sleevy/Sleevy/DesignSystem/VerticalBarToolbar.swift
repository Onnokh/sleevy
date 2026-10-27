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

    /// Adds toolbar items everywhere, and asks for the vertical bar where the
    /// device has one. Left to itself, iOS moves a list screen's items between
    /// the bar and the top edge from one visit to the next.
    func toolbarPreferringVerticalBar<Items: ToolbarContent>(
        @ToolbarContentBuilder items: () -> Items
    ) -> some View {
        modifier(ToolbarPreferringVerticalBar(items: items()))
    }
}

private struct ToolbarPreferringVerticalBar<Items: ToolbarContent>: ViewModifier {
    let items: Items

    func body(content: Content) -> some View {
        #if canImport(SwiftUI, _version: 8.0.85)
        if #available(iOS 27.1, *) {
            content.toolbar { items.axisBehavior(.verticalPreferred) }
        } else {
            content.toolbar { items }
        }
        #else
        content.toolbar { items }
        #endif
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
