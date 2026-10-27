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
                heading("Sleeve")
            }

            Section {
                ForEach(store.folders) { folder in
                    folderRow(folder, count: complete.folderCounts[folder.id, default: 0])
                }
            } header: {
                heading("Folders") {
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
        .listStyle(.sidebar)
        // Headings only as tall as their text, and a group as far from the
        // next heading as on the web.
        .environment(\.defaultMinListHeaderHeight, 0)
        .listSectionSpacing(20)
        // As on the web, the symbols start under the mark and the counts
        // end under the toggle: the rows as wide as the bar, less the space
        // a sidebar row keeps around its text.
        .contentMargins(.horizontal, Self.barInset - Self.rowTextInset, for: .scrollContent)
        // The web's rows: smaller than a sidebar's default, in its colours.
        .font(.subheadline)
        .environment(\.defaultMinListRowHeight, 34)
        .scrollContentBackground(.hidden)
        .background(Color(.surface))
        // On the line of the sidebar button, which the split view keeps in
        // one place and at one size, open or closed.
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                brand
            }
            .sharedBackgroundHiddenIfAvailable()
        }
        .navigationBarTitleDisplayMode(.inline)
        .folderActions(store: store, editor: $folderEditor, folderToDelete: $folderToDelete)
    }

    /// The mark and the name, as the web's sidebar starts.
    private var brand: some View {
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

    /// How far the bar keeps its items from the sides of the column.
    private static let barInset: CGFloat = 20
    /// How far a sidebar row keeps its text from its sides. The list sets
    /// it, not `listRowInsets`.
    private static let rowTextInset: CGFloat = 16

    /// A small, faint heading over a group of rows, with what it holds at
    /// its end.
    private func heading(
        _ title: String,
        @ViewBuilder accessory: () -> some View = { EmptyView() }
    ) -> some View {
        HStack {
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(Color(.faint))
            Spacer()
            accessory()
                // A heading keeps more space at its end than a row: this puts
                // the accessory under the counts.
                .padding(.trailing, -8)
        }
        // Nearer its rows than a row is to the next, as on the web.
        .padding(.vertical, -8)
    }

    /// The web's disclosure, not the system's: the system's chevron is
    /// neither faint nor of a heading's height.
    private var tagsHeading: some View {
        Button {
            withAnimation { showsTags.toggle() }
        } label: {
            heading("Tags") {
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

private extension View {
    /// A row as the web's sidebar draws it: the name and its symbol in the
    /// text colour, a faint count, and the row on screen on a fill.
    func sidebarRow(isSelected: Bool, count: Int) -> some View {
        foregroundStyle(.primary)
            // Before the background: a badge set after it drops it.
            .badge(count > 0 ? Text(count, format: .number).font(.caption).foregroundStyle(Color(.faint)) : nil)
            .listRowBackground(SelectedRowBackground(isSelected: isSelected))
            .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
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
