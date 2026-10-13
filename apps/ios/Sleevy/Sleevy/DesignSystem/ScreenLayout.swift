import SwiftUI

/// The count line under a pushed screen's large title — "4 saves · 2 unread"
/// — as the list's first row.
///
/// A row and not `navigationSubtitle`: on a pushed screen the system subtitle
/// collapses the large title to inline. The root screens of a tab use the
/// system subtitle instead.
struct ListSubtitleRow: View {
    let subtitle: String?

    var body: some View {
        if let subtitle {
            Text(subtitle)
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
                .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 10, trailing: 20))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
    }
}

/// The small, quiet heading over a group of rows: "Today", "Yesterday".
/// Not a `Section` header, so it scrolls with the rows rather than sticking
/// to the top of a plain list.
struct ListGroupHeading: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: 15))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .listRowInsets(EdgeInsets(top: 18, leading: 20, bottom: 4, trailing: 20))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }
}
