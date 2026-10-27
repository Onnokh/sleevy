import SwiftUI

/// Applies `navigationSubtitle` where the OS has it; earlier systems simply
/// show no subtitle.
struct NavigationSubtitleIfAvailable: ViewModifier {
    let subtitle: String?

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            // An empty subtitle rather than a conditional branch: flipping
            // between branches when the subtitle first resolves would swap
            // the content's structural identity, resetting a pushed list's
            // scroll state and collapsing its large title.
            //
            // A space, not an empty string: the subtitle's line stays when
            // there is no subtitle. A line that comes in later makes the
            // large title taller, but the list under it does not move down,
            // so the title goes up under the bar and the bar cuts it.
            content.navigationSubtitle(subtitle ?? " ")
        } else {
            content
        }
    }
}
