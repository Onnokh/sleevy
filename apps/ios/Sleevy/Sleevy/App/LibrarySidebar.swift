import SwiftUI

/// A row in the Library Sidebar.
enum LibrarySidebarItem: Hashable {
    case profile
    case settings
    case recents
    case library
    case search
    case folder(Folder.ID)
    case tag(String)
}

extension EnvironmentValues {
    /// Whether the Library sits beside a Library Sidebar, open or closed.
    /// The Library home then leaves out its Folder strip: the sidebar lists
    /// the Folders.
    @Entry var showsLibrarySidebar = false
}

/// The sidebar of a wide window, as the Web Companion draws its own: the
/// mark, the Public Profile and Settings, Recents, the Library and Search,
/// then the Folders and the Tags, each with its count, in small rows in the
/// web's colours. What a row opens is the root of the content column.
struct LibrarySidebar: View {
    @Environment(ProfileStore.self) private var profileStore
    var store: ReadingListStore
    @Binding var selection: LibrarySidebarItem?
    @State private var folderEditor: FolderEditor?
    @State private var folderToDelete: Folder?
    /// Closed at first, and kept as the reader leaves it, as on the web.
    @AppStorage("librarySidebar.showsTags") private var showsTags = false

    var body: some View {
        let complete = store.libraryProjection(
            for: .completeLibrary,
            filter: LibraryFilter(),
            sort: .newest,
            facetOrder: .frequency
        )

        // Buttons, not links in a selecting list: on a phone, and the Duo is
        // one, a link row lets go of its fill once the tap is done, so the
        // row on screen would show nothing.
        List {
            Section {
                link("Public Profile", systemImage: "globe", item: .profile)
                link("Settings", systemImage: "gearshape", item: .settings)
            }

            Section {
                link("Recents", systemImage: "clock", item: .recents, count: complete.items.count { !$0.isRead })
                // The whole Library, Folders included, as its subtitle counts.
                link("Library", systemImage: "books.vertical", item: .library, count: complete.destinationCount)
                link("Search", systemImage: "magnifyingglass", item: .search)
            } header: {
                SidebarHeading("Sleeve")
            }

            Section {
                ForEach(store.folders) { folder in
                    folderRow(folder, count: complete.folderCounts[folder.id, default: 0])
                }
            } header: {
                SidebarHeading("Folders") {
                    Button {
                        folderEditor = .create
                    } label: {
                        Image(systemName: "plus")
                    }
                    .foregroundStyle(Color(.faint))
                    .accessibilityLabel("New Folder")
                }
            }

            if !complete.tags.isEmpty {
                Section {
                    if showsTags {
                        ForEach(complete.tags) { tag in
                            link(tagDisplayName(tag.value), systemImage: "number", item: .tag(tag.value), count: tag.count)
                        }
                    }
                } header: {
                    tagsHeading
                }
            }
        }
        .sidebarList()
        .folderActions(store: store, editor: $folderEditor, folderToDelete: $folderToDelete)
    }

    /// The web's disclosure, not the system's: the system's chevron is
    /// neither faint nor of a heading's height.
    private var tagsHeading: some View {
        Button {
            withAnimation { showsTags.toggle() }
        } label: {
            SidebarHeading("Tags") {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color(.faint))
                    .rotationEffect(.degrees(showsTags ? 90 : 0))
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityValue(showsTags ? "Open" : "Closed")
        .accessibilityAddTraits(.isHeader)
    }

    private func link(
        _ title: String,
        systemImage: String,
        item: LibrarySidebarItem,
        count: Int = 0
    ) -> some View {
        Button {
            selection = item
        } label: {
            Label {
                // On the text itself: the sidebar's label style sets the
                // title's font, and with it drops a weight set around it.
                Text(title).fontWeight(selection == item ? .semibold : nil)
            } icon: {
                Image(systemName: systemImage)
            }
        }
        .sidebarRow(isSelected: selection == item, count: count)
    }

    private func folderRow(_ folder: Folder, count: Int) -> some View {
        Button {
            selection = .folder(folder.id)
        } label: {
            Label {
                HStack {
                    Text(folder.name)
                        .fontWeight(selection == .folder(folder.id) ? .semibold : nil)
                    // As on the web: the marker only while a visitor can see it.
                    if profileStore.isPublic && folder.isPublished {
                        Spacer()
                        Image(systemName: "globe")
                            .foregroundStyle(Color(.faint))
                            .accessibilityLabel("On your profile")
                    }
                }
            } icon: {
                if let emoji = folder.emoji, !emoji.isEmpty {
                    Text(emoji)
                } else {
                    Image(systemName: "folder")
                }
            }
        }
        .sidebarRow(isSelected: selection == .folder(folder.id), count: count)
        .contextMenu {
            Button {
                folderEditor = .rename(folder)
            } label: {
                Label("Edit", systemImage: "pencil")
            }

            Button {
                Task {
                    do {
                        try await store.setFolderPublished(folder, isPublished: !folder.isPublished)
                    } catch {
                        store.libraryErrorMessage = error.localizedDescription
                    }
                }
            } label: {
                Label(
                    folder.isPublished ? "Remove from Profile" : "Publish to Profile",
                    systemImage: "globe"
                )
            }

            Divider()

            Button(role: .destructive) {
                folderToDelete = folder
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
