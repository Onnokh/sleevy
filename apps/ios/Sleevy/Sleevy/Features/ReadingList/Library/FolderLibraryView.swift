import SwiftUI

@MainActor
struct FolderLibraryView: View {
    let folder: Folder
    var store: ReadingListStore
    @State private var filter = LibraryFilter()
    @State private var sort = LibrarySort.newest
    @State private var isShowingFilters = false
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let projection = store.libraryProjection(
            for: .folder(currentFolder.id),
            filter: filter,
            sort: sort,
            facetOrder: .name
        )

        List {
            // One section, so the first date heading sits close under
            // the filters: the space between groups would push it down.
            Section {
                if filter.isActive {
                    ActiveLibraryFilters(filter: $filter)
                        .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }

                if let errorMessage = store.libraryErrorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }

                // Not while the Folder loads: the empty state would flash before
                // its saves arrive.
                if projection.items.isEmpty,
                   store.snapshot(for: .folder(currentFolder.id)).coverage.hasLoaded {
                    ContentUnavailableView(
                        filter.isActive ? "No Matching Items" : "Folder is Empty",
                        systemImage: filter.isActive ? "line.3.horizontal.decrease.circle" : "folder",
                        description: Text(filter.isActive ? "Try changing or clearing your filters." : "Move saved items here from your Library.")
                    )
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
            }
            .listSectionSpacing(ListRhythm.leadSpacing)

            SavedItemListRows(items: projection.items, store: store, groupsByDate: sort.isByDate)
        }
        .listStyle(.plain)
        .groupedSavesList()
        .scrollContentBackground(.hidden)
        .background(Color(.systemBackground))
        .navigationTitle(currentFolder.name)
        .navigationBarTitleDisplayMode(.large)
        .modifier(NavigationSubtitleIfAvailable(subtitle: navigationSubtitleText(
            total: projection.destinationCount,
            unread: projection.unreadDestinationCount,
            isPublished: currentFolder.isPublished
        )))
        .toolbarPreferringVerticalBar {
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
        .task(id: currentFolder.id) {
            await store.loadIfNeeded(for: .folder(currentFolder.id))
        }
        .refreshable {
            await store.refresh(.folder(currentFolder.id))
        }
        // Favicons warm as soon as items arrive, off the scroll path.
        .task(id: projection.items) {
            await FaviconPrefetcher.warm(items: projection.items, colorScheme: colorScheme)
        }
    }

    private var currentFolder: Folder {
        store.folders.first(where: { $0.id == folder.id }) ?? folder
    }

    /// "12 saves · 3 unread", dropping the unread part once everything is
    /// read, and the whole subtitle while the folder is empty. A Published
    /// Folder says so.
    private func navigationSubtitleText(total: Int, unread: Int, isPublished: Bool) -> String? {
        guard total > 0 else { return isPublished ? "Public" : nil }

        let saves = total == 1 ? "1 save" : "\(total) saves"
        let counts = unread > 0 ? "\(saves) · \(unread) unread" : saves
        return isPublished ? "\(counts) · Public" : counts
    }
}

/// Every Saved Item with one Tag, across the whole Library and every Folder.
@MainActor
struct TagLibraryView: View {
    let tag: String
    var store: ReadingListStore
    @State private var filter = LibraryFilter()
    @State private var sort = LibrarySort.newest
    @State private var isShowingFilters = false
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        var tagFilter = filter
        tagFilter.tag = tag
        let projection = store.libraryProjection(
            for: .completeLibrary,
            filter: tagFilter,
            sort: sort,
            facetOrder: .name
        )
        let unread = projection.items.count { !$0.isRead }

        return List {
            // One section, so the first date heading sits close under
            // the filters: the space between groups would push it down.
            Section {
                if filter.isActive {
                    ActiveLibraryFilters(filter: $filter)
                        .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }

                if projection.items.isEmpty {
                    ContentUnavailableView(
                        "No Saves",
                        systemImage: "number",
                        description: Text("Saves with this Tag appear here.")
                    )
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
            }
            .listSectionSpacing(ListRhythm.leadSpacing)

            SavedItemListRows(items: projection.items, store: store, groupsByDate: sort.isByDate)
        }
        .listStyle(.plain)
        .groupedSavesList()
        .scrollContentBackground(.hidden)
        .background(Color(.systemBackground))
        .navigationTitle(tagDisplayName(tag))
        .navigationBarTitleDisplayMode(.large)
        .modifier(NavigationSubtitleIfAvailable(subtitle: projection.items.isEmpty ? nil : {
            let saves = projection.items.count == 1 ? "1 save" : "\(projection.items.count) saves"
            return unread > 0 ? "\(saves) · \(unread) unread" : saves
        }()))
        .toolbarPreferringVerticalBar {
            ToolbarItem(placement: .topBarTrailing) {
                LibrarySortMenu(sort: $sort, filter: $filter, isShowingFilters: $isShowingFilters)
            }
        }
        .sheet(isPresented: $isShowingFilters) {
            // The Tag is the screen itself, so the sheet filters by the rest.
            LibraryFilterSheet(
                filter: $filter,
                tags: [],
                sources: projection.sources,
                types: projection.types
            )
        }
        .task {
            await store.loadIfNeeded(for: .completeLibrary)
        }
        .refreshable {
            await store.refresh(.completeLibrary)
        }
        .task(id: projection.items) {
            await FaviconPrefetcher.warm(items: projection.items, colorScheme: colorScheme)
        }
    }
}

/// Sort, Read State and Filters for a list of saves, as one toolbar menu.
struct LibrarySortMenu: View {
    @Environment(\.pushRoute) private var pushRoute
    @Binding var sort: LibrarySort
    @Binding var filter: LibraryFilter
    @Binding var isShowingFilters: Bool
    /// Tags to open from the menu, each in its Tag View. Empty hides them.
    var tags: [LibraryFilterOption] = []

    var body: some View {
        Menu {
            Picker("Sort", selection: $sort) {
                ForEach(LibrarySort.allCases) { sort in
                    Text(sort.title).tag(sort)
                }
            }

            Divider()

            Picker("Show", selection: $filter.readState) {
                Text("All Saves").tag(ReadStateFilter?.none)
                ForEach(ReadStateFilter.allCases) { readState in
                    Text(readState.title).tag(Optional(readState))
                }
            }

            Divider()

            if !tags.isEmpty {
                Menu {
                    ForEach(tags) { tag in
                        Button {
                            pushRoute(.tag(tag.value))
                        } label: {
                            Text(tagDisplayName(tag.value))
                            Text(tag.count == 1 ? "1 save" : "\(tag.count) saves")
                        }
                    }
                } label: {
                    Label("Tags", systemImage: "number")
                }
            }

            Button {
                isShowingFilters = true
            } label: {
                Label("Filters", systemImage: "line.3.horizontal.decrease")
            }

            if filter.isActive {
                Button(role: .destructive) {
                    filter = LibraryFilter()
                } label: {
                    Label("Clear Filters", systemImage: "xmark.circle")
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease")
                .symbolVariant(filter.isActive ? .circle.fill : .none)
                .contentTransition(.symbolEffect(.replace))
        }
        .accessibilityLabel(filter.isActive ? "Filters Active" : "Sort and Filter")
    }
}

private struct FolderActionsModifier: ViewModifier {
    var store: ReadingListStore
    @Binding var editor: FolderEditor?
    @Binding var folderToDelete: Folder?

    func body(content: Content) -> some View {
        content
            .sheet(item: $editor) { editor in
                FolderEditorSheet(editor: editor) { draft in
                    switch editor {
                    case .create:
                        try await store.createFolder(named: draft.name, emoji: draft.emoji, color: draft.color)
                    case .rename(let folder):
                        try await store.renameFolder(folder, to: draft.name, emoji: draft.emoji, color: draft.color)
                    }
                }
            }
            .alert(
                "Delete \(folderToDelete?.name ?? "Folder")?",
                isPresented: Binding(
                    get: { folderToDelete != nil },
                    set: { if !$0 { folderToDelete = nil } }
                ),
                presenting: folderToDelete
            ) { folder in
                Button("Cancel", role: .cancel) {}
                Button("Delete Folder", role: .destructive) {
                    Task {
                        do {
                            try await store.deleteFolder(folder)
                        } catch {
                            store.libraryErrorMessage = error.localizedDescription
                        }
                        folderToDelete = nil
                    }
                }
            } message: { _ in
                Text("Saved items in this folder are kept in your Library.")
            }
    }
}

extension View {
    func folderActions(
        store: ReadingListStore,
        editor: Binding<FolderEditor?>,
        folderToDelete: Binding<Folder?>
    ) -> some View {
        modifier(FolderActionsModifier(store: store, editor: editor, folderToDelete: folderToDelete))
    }
}
