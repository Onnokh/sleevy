import SwiftUI

/// The vertical rhythm of a plain list of saves, in points.
///
/// A heading sits closer to its own rows than the rows sit to each other,
/// and further from the group above than either, so each group reads as one
/// block. The list must not stretch short rows to its 44 pt default minimum
/// (see `groupedSavesList()`), or a heading floats between the groups.
enum ListRhythm {
    /// Above and below a row's content: with a 26 pt favicon, rows are 46 pt,
    /// and two favicons are 20 pt apart.
    static let rowPadding: CGFloat = 10
    /// Under a heading, added to the padding over the first row: 16 pt from
    /// the heading to its first favicon.
    static let headingSpacing: CGFloat = 6
    /// Between two groups: the list's section spacing.
    static let groupSpacing: CGFloat = 28
    /// Between what is over the first group, such as the Folder chips, and
    /// its heading. Set it on a `Section` around those rows.
    static let leadSpacing: CGFloat = 8
}

/// The small, quiet heading over a group of rows: "Today", "Yesterday".
/// It is a `Section` header, so a plain list keeps it at the top while its
/// rows scroll under it, until the next heading pushes it out.
///
/// The screen colour fills the whole header, so the rows go under it and do
/// not show behind the text. The space between groups is the list's section
/// spacing, not part of the header: a pinned header is only its text.
struct ListGroupHeading: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.bottom, ListRhythm.headingSpacing)
            .background(Color(.systemBackground))
            .listRowInsets(EdgeInsets())
    }
}

extension View {
    /// The layout of a plain list of saves under `ListGroupHeading`s: rows
    /// and headers as tall as their content, so `ListRhythm` is what the list
    /// shows. Set it on the `List`.
    ///
    /// A row that scrolls past a pinned heading goes on under the top safe
    /// area, where the scroll edge effect only blurs it, so it shows again
    /// above the heading. The screen colour there hides it. The top edge
    /// effect is off: it grows under a pinned heading, and shows as a grey
    /// block where the list does not cover it, beside the vertical bar.
    func groupedSavesList() -> some View {
        environment(\.defaultMinListRowHeight, 0)
            .environment(\.defaultMinListHeaderHeight, 0)
            .listSectionSpacing(ListRhythm.groupSpacing)
            .modifier(TopScrollEdgeEffectHidden())
            .overlay(alignment: .top) {
                // A background reaches into the safe area that its view
                // touches; a view with no height draws nothing there.
                Color.clear
                    .frame(height: 1)
                    .background(Color(.systemBackground), ignoresSafeAreaEdges: [.top, .horizontal])
                    .allowsHitTesting(false)
            }
    }
}

private struct TopScrollEdgeEffectHidden: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.scrollEdgeEffectHidden(true, for: .top)
        } else {
            content
        }
    }
}
