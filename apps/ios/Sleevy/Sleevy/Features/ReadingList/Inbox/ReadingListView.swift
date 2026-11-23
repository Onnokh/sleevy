import SwiftUI
import UIKit

struct ReadingListView: View {
    @Environment(\.openSavedItem) private var openSavedItem
    var store: ReadingListStore
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let snapshot = store.snapshot(for: .inbox)

        GeometryReader { geometry in
            readingList(snapshot: snapshot, emptyStateHeight: geometry.size.height * 0.7)
        }
        .listStyle(.plain)
        .groupedSavesList()
        .scrollContentBackground(.hidden)
        .background(Color(.systemBackground))
        .refreshable {
            await store.refresh()
        }
        .navigationTitle("Recents")
        .largeTitleWhereTheBarHasItsOwnLine()
        .modifier(NavigationSubtitleIfAvailable(subtitle: navigationSubtitleText(unreadCount: snapshot.items.count)))
        .addLinkButton(store: store)
        .task {
            await store.loadIfNeeded()
        }
    }

    private func readingList(snapshot: RetrievalSnapshot, emptyStateHeight: CGFloat) -> some View {
        List {
            if store.isLoading,
               snapshot.coverage == .loading,
               snapshot.items.isEmpty,
               store.pendingSavedItems.isEmpty {
                ReadingListLoadingRow(height: emptyStateHeight)
            } else if snapshot.coverage.hasLoaded,
                      snapshot.items.isEmpty,
                      store.pendingSavedItems.isEmpty {
                // Not before the first load: All Caught Up would flash at
                // launch, before the saves arrive.
                EmptyReadingListRow(height: emptyStateHeight)
            }


            if !store.pendingSavedItems.isEmpty {
                Section {
                    ForEach(store.pendingSavedItems) { item in
                        PendingSavedItemRow(item: item) {
                            store.removePendingSavedItem(item)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                store.removePendingSavedItem(item)
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                        }
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                }
            }

            if let errorMessage = store.errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            // Under the same date headings as the Library lists. Each heading
            // stays at the top while its saves scroll, until the next pushes
            // it out.
            let days = SaveDateGroup.groups(snapshot.items)
            ForEach(days) { group in
                Section {
                    ListGroupHeading(title: group.span.title)
                    ForEach(group.items) { item in
                        SavedItemRow(item: item, showsDomain: true) {
                            await markOpened(item)
                        } onToggleRead: {
                            await setRead(item, isRead: !item.isRead)
                        } onDelete: {
                            await store.delete(item)
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button {
                                Task {
                                    await setRead(item, isRead: !item.isRead)
                                }
                            } label: {
                                Label(
                                    item.isRead ? "Unread" : "Read",
                                    systemImage: item.isRead ? "circle" : "checkmark.circle"
                                )
                            }
                            .tint(item.isRead ? .orange : .green)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task {
                                    await store.delete(item)
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                }
            }
        }
        // Favicons warm as soon as items arrive, off the scroll path, so
        // the first scroll through the list never pays a network fetch or
        // an SVG render per row.
        .task(id: snapshot.items) {
            await FaviconPrefetcher.warm(items: snapshot.items, colorScheme: colorScheme)
        }
        .animation(.snappy(duration: 0.24), value: store.pendingSavedItems)
        .animation(.snappy(duration: 0.24), value: snapshot.items)
    }

    private func markOpened(_ item: SavedItem) async {
        // Taken before the save leaves the Inbox, so the Reader View can
        // still step to its neighbours.
        let sequence = store.snapshot(for: .inbox).items.map(\.id)

        withAnimation(.snappy(duration: 0.26)) {
            store.prepareForAnimatedReadStateChange(item)
        }

        await openSavedItem(item, sequence)
    }

    private func setRead(_ item: SavedItem, isRead: Bool) async {
        withAnimation(.snappy(duration: 0.26)) {
            store.prepareForAnimatedReadStateChange(item)
        }

        await store.setRead(item, isRead: isRead)
    }

    private func navigationSubtitleText(unreadCount: Int) -> String? {
        if !store.isOnline { return "Offline" }
        if !store.isAPIReachable { return "Error reaching API" }
        if unreadCount > 0 {
            return "\(unreadCount) unread"
        }

        return nil
    }
}
