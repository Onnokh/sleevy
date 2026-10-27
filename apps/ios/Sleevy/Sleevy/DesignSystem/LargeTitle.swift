import SwiftUI

extension View {
    /// A large title where the bar has a line of its own, as on a phone and
    /// beside the Library Sidebar. Elsewhere the title goes in the bar: a
    /// regular width that still keeps the tab bar, as on an upright iPhone
    /// Duo, puts the bar on the line of the clock. The bar's items then sit
    /// against the clock, and over a large title they float apart from it.
    func largeTitleWhereTheBarHasItsOwnLine() -> some View {
        modifier(LargeTitleWhereTheBarHasItsOwnLine())
    }
}

private struct LargeTitleWhereTheBarHasItsOwnLine: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.showsLibrarySidebar) private var showsLibrarySidebar

    func body(content: Content) -> some View {
        // One modifier with a changing value, not two branches: a branch
        // change would reset the list's scroll position.
        content.navigationBarTitleDisplayMode(
            horizontalSizeClass == .regular && !showsLibrarySidebar ? .inline : .large
        )
    }
}
