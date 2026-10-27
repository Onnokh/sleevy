import SwiftUI

extension EnvironmentValues {
    /// The save on screen in a Reader View whose list of articles is in the
    /// sidebar column, not beside the article. The column sets it to move the
    /// reader on; the Reader View sets it when it moves on by itself.
    @Entry var readerSidebarSelection: Binding<SavedItem.ID?>? = nil
}

/// The articles beside the article, or in the sidebar column where there is
/// one: every Saved Item in this scope that has a Reader View, with the one
/// being read marked.
///
/// Mirrors the list column of the Web Companion's Reader View
/// (`apps/web/src/pages/saved-item-reader-page.tsx`). Restricted to Saved
/// Items that have a Reader View, so every row in it leads somewhere — a row
/// that threw the reader out to the browser would break the one promise the
/// pane makes, which is that reading happens here.
///
/// It is the list the article was opened from — a Folder, a Tag, Recents,
/// Search — as it was at that moment: the Inbox drops a save once it is
/// read, and a reader working down a list should not watch rows vanish
/// behind them.
struct ReadableItemsSidebar: View {
    let items: [SavedItem]
    let selectedID: SavedItem.ID?
    /// Set by the Reader View from the window and the posture, never from the
    /// titles, so the article's measure does not move as the reader steps from
    /// a short title to a long one. Nil in a sidebar column, which sets its
    /// own.
    var width: CGFloat?
    let onSelect: (SavedItem) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            // Drawn as the Library Sidebar, so the column does not change
            // its look when the reader opens an article from it.
            List(items) { item in
                row(for: item)
                    .id(item.id)
            }
            .sidebarList()
            .onAppear {
                // Opening an article from deep in the Library should not leave
                // its row off the top of the list.
                if let selectedID { proxy.scrollTo(selectedID, anchor: .center) }
            }
            .onChange(of: selectedID) { _, id in
                guard let id else { return }
                // No anchor, so the list moves the least it can to bring the
                // row into view — the reader stepping down it should not have
                // the whole column jump under them.
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(id)
                }
            }
        }
        .frame(width: width)
        .accessibilityLabel("Articles")
    }

    private func row(for item: SavedItem) -> some View {
        let isSelected = item.id == selectedID

        return Button {
            onSelect(item)
        } label: {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    // No bolder title for the row on screen, as on the web: a
                    // bolder title is wider, and can wrap and move the rows.
                    Text(item.displayTitle)
                        .lineLimit(2)
                    Text(item.displayDomain)
                        .font(.caption)
                        .foregroundStyle(Color(.faint))
                        .lineLimit(1)
                }
            } icon: {
                SavedItemFavicon(item: item, size: 16)
            }
        }
        .sidebarRow(isSelected: isSelected)
    }
}
