import SwiftUI

/// The articles beside the article: every Saved Item in this scope that has a
/// Reader View, with the one being read marked.
///
/// Mirrors the list column of the Web Companion's Reader View
/// (`apps/web/src/pages/saved-item-reader-page.tsx`). Restricted to Saved
/// Items that have a Reader View, so every row in it leads somewhere — a row
/// that threw the reader out to the browser would break the one promise the
/// pane makes, which is that reading happens here.
///
/// It is a Library surface whatever it was opened from: the Inbox is the
/// triage surface for unread Saved Items, and this list keeps the read ones
/// too, because a reader working down a list should not watch rows vanish
/// behind them.
struct ReadableItemsSidebar: View {
    let items: [SavedItem]
    let selectedID: SavedItem.ID
    /// Set by the Reader View from the window and the posture, never from the
    /// titles, so the article's measure does not move as the reader steps from
    /// a short title to a long one.
    let width: CGFloat
    let onSelect: (SavedItem) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    Text("Library")
                        .font(.system(size: 22, weight: .bold))
                        .padding(.horizontal, 8)
                        .padding(.top, 4)
                        .padding(.bottom, 8)

                    ForEach(items) { item in
                        row(for: item)
                            .id(item.id)
                    }
                }
                .padding(.horizontal, 12)
                // The run-out below the last row, so the final rows can come
                // to rest clear of the bottom edge.
                .padding(.bottom, 64)
            }
            .onAppear {
                // Opening an article from deep in the Library should not leave
                // its row off the top of the list.
                proxy.scrollTo(selectedID, anchor: .center)
            }
            .onChange(of: selectedID) { _, id in
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
            VStack(alignment: .leading, spacing: 3) {
                Text(item.displayTitle)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 5) {
                    SavedItemFavicon(item: item, size: 14)
                    Text(item.displayDomain)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected ? Color.primary.opacity(0.12) : Color.clear)
            )
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }
}
