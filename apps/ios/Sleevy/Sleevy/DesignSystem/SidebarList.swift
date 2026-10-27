import SwiftUI

extension View {
    /// A sidebar list as the web's sidebar draws it: small rows and faint
    /// headings in the web's colours, the symbols under the mark and the
    /// counts under the toggle.
    func sidebarList() -> some View {
        listStyle(.sidebar)
            // Headings only as tall as their text, and a group as far from
            // the next heading as on the web.
            .environment(\.defaultMinListHeaderHeight, 0)
            .listSectionSpacing(20)
            // The rows as wide as the bar, less the space a sidebar row keeps
            // around its text.
            .contentMargins(.horizontal, SidebarMetrics.barInset - SidebarMetrics.rowTextInset, for: .scrollContent)
            // The web's rows: smaller than a sidebar's default.
            .font(.subheadline)
            .environment(\.defaultMinListRowHeight, 34)
            .scrollContentBackground(.hidden)
    }

    /// A row as the web's sidebar draws it: the name and its symbol in the
    /// text colour, a faint count, and the row on screen on a fill.
    func sidebarRow(isSelected: Bool, count: Int = 0) -> some View {
        foregroundStyle(.primary)
            // Before the background: a badge set after it drops it.
            .badge(count > 0 ? Text(count, format: .number).font(.caption).foregroundStyle(Color(.faint)) : nil)
            .listRowBackground(SelectedRowBackground(isSelected: isSelected))
            .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    /// What every view in the sidebar column has: the web's sidebar colour,
    /// and on the line of the sidebar button, which the split view keeps in
    /// one place and at one size, open or closed, the mark — or, a level
    /// down, the way back and the name of the list.
    func sidebarColumn(level: SidebarLevel? = nil) -> some View {
        background(Color(.surface))
            .toolbar {
                if let level {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Back", systemImage: "chevron.backward", action: level.back)
                    }
                }
                // One item for the mark and the name, so a change of level
                // changes its text and does not fly a new item in.
                ToolbarItem(placement: .topBarLeading) {
                    if let level {
                        Text(level.title)
                            .font(.title3.weight(.semibold))
                            .fixedSize()
                            .accessibilityAddTraits(.isHeader)
                    } else {
                        SidebarBrand()
                    }
                }
                .sharedBackgroundHiddenIfAvailable()
            }
            .navigationBarTitleDisplayMode(.inline)
    }
}

/// A list one level down in the sidebar column, under the Library Sidebar:
/// the list a Reader View was opened from.
struct SidebarLevel {
    let title: String
    let back: () -> Void
}

/// A small, faint heading over a group of rows in a sidebar list, with what
/// it holds at its end.
struct SidebarHeading<Accessory: View>: View {
    let title: String
    let accessory: Accessory

    init(_ title: String, @ViewBuilder accessory: () -> Accessory = { EmptyView() }) {
        self.title = title
        self.accessory = accessory()
    }

    var body: some View {
        HStack {
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(Color(.faint))
            Spacer()
            accessory
                // A heading keeps more space at its end than a row: this puts
                // the accessory under the counts.
                .padding(.trailing, -8)
        }
        // Nearer its rows than a row is to the next, as on the web.
        .padding(.vertical, -8)
    }
}

private enum SidebarMetrics {
    /// How far the bar keeps its items from the sides of the column.
    static let barInset: CGFloat = 20
    /// How far a sidebar row keeps its text from its sides. The list sets
    /// it, not `listRowInsets`.
    static let rowTextInset: CGFloat = 16
}

/// The fill behind the row on screen, which a phone's sidebar list does not
/// keep.
private struct SelectedRowBackground: View {
    let isSelected: Bool

    var body: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(Color(.surfaceActive))
            // Half of the text's inset: the web's fill is a little wider
            // than the mark and the toggle.
            .padding(.horizontal, 8)
            .opacity(isSelected ? 1 : 0)
            .animation(.easeOut(duration: 0.15), value: isSelected)
    }
}

/// The mark and the name, as the web's sidebar starts.
private struct SidebarBrand: View {
    var body: some View {
        HStack(spacing: 10) {
            // A set colour: the toolbar dims a shape filled with `.primary`.
            SleevyBrandmark()
                .fill(Color(.label))
                // The web's 25 points high, at the mark's own proportions.
                .frame(width: 25 * 462 / 587, height: 25)
            Text("Sleevy")
                .font(.title3.weight(.semibold))
        }
        // A toolbar item gets only the width it asks for, and cuts the name.
        .fixedSize()
        .accessibilityElement(children: .combine)
    }
}

private extension ToolbarItem {
    /// No glass behind the brand: it is not a button.
    @ToolbarContentBuilder
    func sharedBackgroundHiddenIfAvailable() -> some ToolbarContent {
        if #available(iOS 26, *) {
            sharedBackgroundVisibility(.hidden)
        } else {
            self
        }
    }
}
