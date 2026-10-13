import SwiftUI

/// The Library home: the Folders and the Tags as a sidebar, with counts, and
/// under them the Saved Items that are in no Folder (the No Folder Filter).
/// Those have no heading of their own: they are simply what the Library holds
/// outside its Folders.
@MainActor
struct LibraryView: View {
    @Environment(\.pushRoute) private var pushRoute
    var store: ReadingListStore
    @State private var filter = LibraryFilter()
    @State private var sort = LibrarySort.newest
    @State private var isShowingFilters = false
    @State private var folderEditor: FolderEditor?
    @State private var folderToDelete: Folder?
    @State private var showsFolders = true
    @State private var showsTags = true
    @Environment(\.colorScheme) private var colorScheme

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
                libraryList(projection: projection, complete: complete)
            }
        }
        .background(Color(.systemBackground))
        .navigationTitle("Library")
        .navigationBarTitleDisplayMode(.large)
        .modifier(NavigationSubtitleIfAvailable(subtitle: savesText(complete.destinationCount)))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                LibrarySortMenu(sort: $sort, filter: $filter, isShowingFilters: $isShowingFilters)
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

    private func libraryList(projection: LibraryProjection, complete: LibraryProjection) -> some View {
        List {
            SidebarHeading(title: "Folders", isExpanded: $showsFolders)

            if showsFolders {
                ForEach(store.folders) { folder in
                    FolderRow(
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
                    SidebarRow(systemImage: "plus", title: "New Folder")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .sidebarRowStyle()
            }

            if !complete.tags.isEmpty {
                SidebarHeading(title: "Tags", isExpanded: $showsTags)

                if showsTags {
                    ForEach(complete.tags, id: \.value) { tag in
                        Button {
                            pushRoute(.tag(tag.value))
                        } label: {
                            SidebarRow(systemImage: "number", title: tagDisplayName(tag.value), count: tag.count)
                        }
                        .buttonStyle(.plain)
                        .sidebarRowStyle()
                    }
                }
            }

            if let errorMessage = store.libraryErrorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            // The No Folder Filter: what the Library holds outside its
            // Folders, set apart by space rather than by a name.
            Color.clear
                .frame(height: 14)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

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

            SavedItemListRows(items: projection.items, store: store)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .animation(.snappy(duration: 0.24), value: showsFolders)
        .animation(.snappy(duration: 0.24), value: showsTags)
    }

    private func savesText(_ count: Int) -> String? {
        guard count > 0 else { return nil }
        return count == 1 ? "1 save" : "\(count) saves"
    }
}

/// A sidebar section's heading: its name and a chevron that folds it away.
struct SidebarHeading: View {
    let title: String
    @Binding var isExpanded: Bool

    var body: some View {
        Button {
            isExpanded.toggle()
        } label: {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .rotationEffect(.degrees(isExpanded ? 0 : -90))
            }
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 20, leading: 20, bottom: 6, trailing: 20))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .accessibilityAddTraits(.isHeader)
        .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")
    }
}

/// One line of the Library sidebar: an outline symbol, a name, an optional
/// marker after the name, and a count at the trailing edge.
struct SidebarRow<Marker: View>: View {
    let systemImage: String
    let title: String
    var count: Int?
    @ViewBuilder var marker: Marker

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 17))
                .foregroundStyle(.secondary)
                .frame(width: 24)

            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 17))
                    .lineLimit(1)
                marker
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let count {
                Text("\(count)")
                    .font(.system(size: 17))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 11)
        .contentShape(.rect)
    }
}

extension SidebarRow where Marker == EmptyView {
    init(systemImage: String, title: String, count: Int? = nil) {
        self.init(systemImage: systemImage, title: title, count: count) { EmptyView() }
    }
}

extension View {
    /// The insets and the bare background every sidebar row shares.
    func sidebarRowStyle() -> some View {
        listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }
}

/// One Folder in the Library sidebar. Tap opens its Folder View; the
/// Folder's other actions are behind a long-press. A globe marks a Published
/// Folder.
struct FolderRow: View {
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
            SidebarRow(systemImage: "folder", title: folder.name, count: itemCount) {
                if folder.isPublished {
                    Image(systemName: "globe")
                        .font(.system(size: 12))
                        .foregroundStyle(.tertiary)
                        .accessibilityHidden(true)
                }
            }
        }
        .buttonStyle(.plain)
        .sidebarRowStyle()
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
/// home, a Folder View, a Tag and Search all list saves the same way.
struct SavedItemListRows: View {
    @Environment(\.openSavedItem) private var openSavedItem
    let items: [SavedItem]
    let store: ReadingListStore
    var showsUnreadIndicator = true

    var body: some View {
        ForEach(items) { item in
            SavedItemRow(item: item, showsUnreadIndicator: showsUnreadIndicator) {
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
