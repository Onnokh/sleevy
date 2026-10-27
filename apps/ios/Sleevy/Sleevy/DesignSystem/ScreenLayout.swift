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
/// A row, not a `Section` header, so it scrolls with its rows: a plain list
/// pins a header under the bar, and rows that scroll past it show above it.
/// Put it first in its `Section`.
struct ListGroupHeading: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.bottom, ListRhythm.headingSpacing)
            .accessibilityAddTraits(.isHeader)
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }
}

extension View {
    /// The layout of a plain list of saves under `ListGroupHeading`s: rows
    /// as tall as their content, so `ListRhythm` is what the list shows.
    /// Set it on the `List`.
    func groupedSavesList() -> some View {
        environment(\.defaultMinListRowHeight, 0)
            .listSectionSpacing(ListRhythm.groupSpacing)
    }
}
