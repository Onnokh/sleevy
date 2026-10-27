import SwiftUI

/// The Library home: the Saved Items that are in no Folder (the No Folder
/// Filter), under one compact strip of Folders. The saves have
/// no heading of their own: they are simply what the Library holds outside its
/// Folders.
@MainActor
struct LibraryView: View {
    @Environment(\.pushRoute) private var pushRoute
    var store: ReadingListStore
    @State private var filter = LibraryFilter()
    @State private var sort = LibrarySort.newest
    @State private var isShowingFilters = false
    @State private var folderEditor: FolderEditor?
    @State private var folderToDelete: Folder?
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.showsLibrarySidebar) private var showsLibrarySidebar

    var body: some View {
        let projection = store.libraryProjection(
            for: .libraryRoot,
            filter: filter,
            sort: sort,
            facetOrder: .frequency
        )
        // The Tags and the count cover the whole Library, Folders included:
        // a Tag leads to every save that carries it.
        let complete = store.libraryProjection(
            for: .completeLibrary,
            filter: LibraryFilter(),
            sort: .newest,
            facetOrder: .name
        )

        Group {
            if store.isLoading && projection.destinationCount == 0 && store.folders.isEmpty {
                ProgressView("Loading your library...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                libraryList(projection: projection)
            }
        }
        .background(Color(.systemBackground))
        .navigationTitle("Library")
        .largeTitleWhereTheBarHasItsOwnLine()
        .modifier(NavigationSubtitleIfAvailable(subtitle: savesText(complete.destinationCount)))
        .toolbarPreferringVerticalBar {
            ToolbarItem(placement: .primaryAction) {
                LibrarySortMenu(
                    sort: $sort,
                    filter: $filter,
                    isShowingFilters: $isShowingFilters,
                    tags: complete.tags
                )
            }
        }
        .sheet(isPresented: $isShowingFilters) {
            LibraryFilterSheet(
                filter: $filter,
                tags: projection.tags,
                sources: projection.sources,
                types: projection.types
            )
        }
        .folderActions(store: store, editor: $folderEditor, folderToDelete: $folderToDelete)
        .task {
            await store.loadIfNeeded(for: .libraryRoot)
            await store.loadIfNeeded(for: .completeLibrary)
        }
        // Favicons warm as soon as items arrive, off the scroll path.
        .task(id: projection.items) {
            await FaviconPrefetcher.warm(items: projection.items, colorScheme: colorScheme)
        }
        .refreshable {
            await store.refresh(.libraryRoot)
        }
    }

    private func libraryList(projection: LibraryProjection) -> some View {
        List {
            // One section, so the first date heading sits close under
            // the chips: the space between groups would push it down.
            Section {
                // Folders are ways in, not the content: one compact strip, so
                // the saves start near the top. Tags are in the sort menu.
                // Beside the Library Sidebar, the sidebar lists them.
                if !showsLibrarySidebar {
                    ChipStrip {
                        ForEach(store.folders) { folder in
                            FolderChip(
                                folder: folder,
                                itemCount: projection.folderCounts[folder.id, default: 0]
                            ) {
                                folderEditor = .rename(folder)
                            } onDelete: {
                                folderToDelete = folder
                            } onSetPublished: { isPublished in
                                Task {
                                    do {
                                        try await store.setFolderPublished(folder, isPublished: isPublished)
                                    } catch {
                                        store.libraryErrorMessage = error.localizedDescription
                                    }
                                }
                            }
                        }

                        Button {
                            folderEditor = .create
                        } label: {
                            LibraryChip(title: "New Folder") {
                                Image(systemName: "plus")
                            }
                            .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if let errorMessage = store.libraryErrorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }

                if filter.isActive {
                    ActiveLibraryFilters(filter: $filter)
                        .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)

                    if projection.items.isEmpty {
                        ContentUnavailableView(
                            "No Matching Items",
                            systemImage: "line.3.horizontal.decrease.circle",
                            description: Text("Try changing or clearing your filters.")
                        )
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                }
            }
            .listSectionSpacing(ListRhythm.leadSpacing)

            SavedItemListRows(items: projection.items, store: store, groupsByDate: sort.isByDate)
        }
        .listStyle(.plain)
        .groupedSavesList()
        .scrollContentBackground(.hidden)
    }

    private func savesText(_ count: Int) -> String? {
        guard count > 0 else { return nil }
        return count == 1 ? "1 save" : "\(count) saves"
    }
}

/// The horizontally scrolling row of Folder chips in the Library home.
struct ChipStrip<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                content
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
        // The chips fade out at the edges, so a strip that runs on past the
        // screen reads as one that scrolls, not as one cut off.
        .mask {
            HStack(spacing: 0) {
                LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing)
                    .frame(width: 12)
                Rectangle()
                LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing)
                    .frame(width: 32)
            }
        }
        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }
}

/// A chip in the Folder strip: the badge, the name and the count on a
/// capsule in the Folder's colour. The colour is light and the chip is low,
/// so the strip stays a way in and the saves under it are the content.
struct LibraryChip<Badge: View>: View {
    let title: String
    var count = 0
    /// The Folder's colours, or nil for a chip that is not a Folder.
    var palette: FolderCardPalette?
    @ViewBuilder var badge: Badge

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 6) {
            badge
                .font(.system(size: 14))

            Text(title)
                .font(.system(size: 15, weight: .medium))
                .lineLimit(1)

            if count > 0 {
                Text("\(count)")
                    .font(.system(size: 13))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(fill, in: .capsule)
        .overlay { Capsule().strokeBorder(border, lineWidth: 1) }
        .contentShape(.capsule)
    }

    /// A Folder's chip is lightly filled with its colour, with an edge in the
    /// same colour, so each Folder is found by its colour at a glance.
    private var fill: Color {
        guard let palette else { return .primary.opacity(0.06) }
        return Color(palette.mid).opacity(colorScheme == .dark ? 0.24 : 0.16)
    }

    private var border: Color {
        guard let palette else { return .primary.opacity(0.08) }
        return Color(palette.mid).opacity(colorScheme == .dark ? 0.4 : 0.35)
    }
}

/// One Folder in the Library home's Folder strip, in its emoji and colour.
/// Tap opens its Folder View; the Folder's other actions are behind a
/// long-press.
struct FolderChip: View {
    let folder: Folder
    let itemCount: Int
    let onRename: @MainActor () -> Void
    let onDelete: @MainActor () -> Void
    let onSetPublished: @MainActor (Bool) -> Void

    @Environment(\.pushRoute) private var pushRoute

    var body: some View {
        Button {
            pushRoute(.folder(id: folder.id))
        } label: {
            LibraryChip(title: folder.name, count: itemCount, palette: FolderCardPalette.named(folder.color)) {
                FolderBadge(folder: folder, size: 14)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(folder.name)
        .accessibilityValue(accessibilityCountLabel)
        .contextMenu {
            Button(action: onRename) {
                Label("Edit", systemImage: "pencil")
            }

            // The label states what the action does next, so the stored state
            // stays legible even while Profile Visibility is private.
            Button {
                onSetPublished(!folder.isPublished)
            } label: {
                Label(
                    folder.isPublished ? "Remove from Profile" : "Publish to Profile",
                    systemImage: "globe"
                )
            }

            Divider()

            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private var accessibilityCountLabel: String {
        let count = itemCount == 1 ? "1 saved item" : "\(itemCount) saved items"
        return folder.isPublished ? "\(count), on your public profile" : count
    }
}

/// The rows of a list of Saved Items with their swipe actions: the Library
/// home, a Folder View, a Tag and Search all list saves the same way. Sorted
/// by date, a list can put the saves under date headings, as Recents does.
struct SavedItemListRows: View {
    @Environment(\.openSavedItem) private var openSavedItem
    let items: [SavedItem]
    let store: ReadingListStore
    var groupsByDate = false

    var body: some View {
        if groupsByDate {
            let groups = SaveDateGroup.groups(items)
            ForEach(groups) { group in
                Section {
                    ListGroupHeading(title: group.span.title)
                    rows(group.items)
                }
            }
        } else {
            rows(items)
        }
    }

    private func rows(_ slice: [SavedItem]) -> some View {
        ForEach(slice) { item in
            SavedItemRow(item: item, showsDomain: true) {
                // The whole list, not one group: the Reader View steps on
                // past a heading.
                await openSavedItem(item, items.map(\.id))
            } onToggleRead: {
                await store.setRead(item, isRead: !item.isRead)
            } onDelete: {
                await store.delete(item)
            }
            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                Button {
                    Task { await store.setRead(item, isRead: !item.isRead) }
                } label: {
                    Label(item.isRead ? "Unread" : "Read", systemImage: item.isRead ? "circle" : "checkmark.circle")
                }
                .tint(item.isRead ? .orange : .green)
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                Button(role: .destructive) {
                    Task { await store.delete(item) }
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

/// A Folder's emoji or, where it has none, a dot in its colour, as the web
/// app and the Unread Widget show it.
struct FolderBadge: View {
    let folder: Folder
    let size: CGFloat

    var body: some View {
        if let emoji = folder.emoji, !emoji.isEmpty {
            Text(emoji)
                .font(.system(size: size))
        } else {
            Circle()
                .fill(Color(FolderCardPalette.named(folder.color).mid))
                .frame(width: size * 0.6, height: size * 0.6)
                .frame(width: size, height: size)
        }
    }
}

private extension Color {
    init(_ rgb: SIMD3<Float>) {
        self.init(red: Double(rgb.x), green: Double(rgb.y), blue: Double(rgb.z))
    }
}
