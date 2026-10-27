import os
import SwiftUI

/// The signed-in shell: the tab bar, one navigation stack per stackable tab, and
/// the single `navigationDestination(for: AppRoute.self)` that resolves every
/// push destination through `AppRoute.destination`.
struct SignedInTabView: View {
    @Environment(DeepLinkStore.self) private var deepLinks
    @Environment(AppSettings.self) private var appSettings
    @Environment(\.scenePhase) private var scenePhase
    let session: AppSession
    let store: ReadingListStore
    @State private var profileLoader = PublicProfileLoader()
    @State private var profileStore: ProfileStore
    @State private var selectedTab: AppTab = .library
    @State private var sleevyPath: [AppRoute] = []
    @State private var libraryPath: [AppRoute] = []
    @State private var searchPath: [AppRoute] = []
    @State private var shouldRefreshAfterActivation = false
    @State private var isWide = false
    /// Open at launch, as on the web; `automatic` hides it on the Duo.
    @State private var sidebarVisibility = NavigationSplitViewVisibility.all
    /// A Folder, a Tag, the Public Profile or Settings, chosen in the Library
    /// Sidebar. It is the root of the content column, not pushed on the
    /// Library, so it does not slide in.
    @State private var sidebarDestination: AppRoute?
    @State private var sidebarPath: [AppRoute] = []
    /// The whole window, the system rail included: the hinge of the iPhone
    /// Duo is in its middle.
    @State private var windowWidth: CGFloat = 0
    @State private var isCreased = false

    init(session: AppSession, tokenStore: SessionTokenStore, store: ReadingListStore) {
        self.session = session
        self.store = store
        _profileStore = State(
            wrappedValue: DemoMode.isEnabled ? ProfileStore.demo() : ProfileStore.live(tokenStore: tokenStore)
        )
    }

    var body: some View {
        Group {
            if isWide {
                NavigationSplitView(columnVisibility: $sidebarVisibility) {
                    LibrarySidebar(store: store, selection: sidebarSelection)
                        // A range that stays the same, so only the ideal width
                        // changes on the fold. A single width is also the
                        // minimum and the maximum, and a jump in those hides
                        // the sidebar for a moment.
                        .navigationSplitViewColumnWidth(min: 240, ideal: sidebarWidth, max: max(windowWidth / 2, 280))
                } detail: {
                    if let sidebarDestination {
                        sidebarDestinationStack(sidebarDestination)
                    } else {
                        switch selectedTab {
                        case .sleevy: recentsStack
                        case .library: libraryStack
                        case .search: searchStack
                        }
                    }
                }
                // Beside the content, never over it.
                .navigationSplitViewStyle(.balanced)
                // Closed, the sidebar is only out of sight: the Library still
                // leaves its Folders to it.
                .environment(\.showsLibrarySidebar, true)
            } else {
                TabView(selection: selectedTabBinding) {
                    Tab("Library", systemImage: "books.vertical", value: AppTab.library) {
                        libraryStack
                    }

                    Tab("Recents", systemImage: "clock", value: AppTab.sleevy) {
                        recentsStack
                    }

                    Tab(value: AppTab.search, role: .search) {
                        searchStack
                    }
                }
            }
        }
        // As on the web: below 768 points the sidebar would leave the saves
        // too narrow, so a phone and the Duo held tall keep the tab bar.
        .onGeometryChange(for: Bool.self) { proxy in
            proxy.size.width >= 768
        } action: { isWide in
            self.isWide = isWide
        }
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.size.width + proxy.safeAreaInsets.leading + proxy.safeAreaInsets.trailing
        } action: { windowWidth in
            self.windowWidth = windowWidth
        }
        .onCreaseChange { isCreased in
            // The hinge reports each change of its angle; animate only a
            // change of posture.
            guard isCreased != self.isCreased else { return }
            withAnimation(.smooth) { self.isCreased = isCreased }
        }
        .onChange(of: isWide) { _, isWide in
            keepPlace(isWide: isWide)
            // Opened out, the Duo shows its sidebar, as at launch, whatever
            // it was when the window was last wide.
            if isWide { resetSidebar() }
        }
        .onChange(of: isReading) { resetSidebar() }
        .environment(profileLoader)
        .environment(profileStore)
        .environment(\.moveToFolder, moveToFolderAction)
        .task {
            // Folder cards suppress their published marker while the profile
            // is private, so the record must be known outside the profile page.
            await profileStore.load()
            await openDemoScreenIfNeeded()
        }
        .onChange(of: scenePhase) { _, newPhase in
            handleScenePhaseChange(newPhase)
        }
        // `initial` so a URL that arrived while the session was still being
        // restored is handled the moment the shell exists.
        .onChange(of: deepLinks.pending, initial: true) { _, link in
            guard let link else { return }
            deepLinks.pending = nil

            Task {
                await open(link)
            }
        }
    }

    private var libraryStack: some View {
        NavigationStack(path: $libraryPath) {
            LibraryView(store: store)
                .accountToolbar(session: session) {
                    libraryPath.append(.settings)
                } onMyProfile: {
                    libraryPath.append(.myProfile)
                }
                .navigationDestination(for: AppRoute.self) { route in
                    route.destination(store: store, session: session)
                }
        }
        // On the stack, not its root view: a pushed Folder or Tag
        // does not inherit what is set on the root.
        .environment(\.pushRoute) { libraryPath.append($0) }
        .environment(\.openSavedItem) { item, sequence in await openItem(item, in: sequence) { libraryPath.append($0) } }
    }

    private var recentsStack: some View {
        NavigationStack(path: $sleevyPath) {
            ReadingListView(store: store)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accountToolbar(session: session) {
                    sleevyPath.append(.settings)
                } onMyProfile: {
                    sleevyPath.append(.myProfile)
                }
                .navigationDestination(for: AppRoute.self) { route in
                    route.destination(store: store, session: session)
                }
        }
        .environment(\.pushRoute) { sleevyPath.append($0) }
        .environment(\.openSavedItem) { item, sequence in await openItem(item, in: sequence) { sleevyPath.append($0) } }
    }

    private var searchStack: some View {
        NavigationStack(path: $searchPath) {
            SearchView(store: store)
                .navigationDestination(for: AppRoute.self) { route in
                    route.destination(store: store, session: session)
                }
        }
        .environment(\.pushRoute) { searchPath.append($0) }
        .environment(\.openSavedItem) { item, sequence in await openItem(item, in: sequence) { searchPath.append($0) } }
    }

    /// A Folder, a Tag, the Public Profile or Settings from the Library
    /// Sidebar, with its own path.
    private func sidebarDestinationStack(_ root: AppRoute) -> some View {
        NavigationStack(path: $sidebarPath) {
            root.destination(store: store, session: session)
                .navigationDestination(for: AppRoute.self) { route in
                    route.destination(store: store, session: session)
                }
        }
        .id(root)
        .environment(\.pushRoute) { sidebarPath.append($0) }
        .environment(\.openSavedItem) { item, sequence in await openItem(item, in: sequence) { sidebarPath.append($0) } }
    }

    /// Creased like a book, the sidebar is the left page and the content
    /// the right, divided on the hinge.
    private var sidebarWidth: CGFloat {
        isCreased ? windowWidth / 2 : 280
    }

    /// Whether a Reader View is on screen in the content column.
    private var isReading: Bool {
        let path: [AppRoute] = if sidebarDestination != nil {
            sidebarPath
        } else {
            switch selectedTab {
            case .sleevy: sleevyPath
            case .library: libraryPath
            case .search: searchPath
            }
        }
        return path.contains { route in
            if case .reader = route { true } else { false }
        }
    }

    /// The sidebar row for where the reader is.
    private var sidebarSelection: Binding<LibrarySidebarItem?> {
        Binding {
            switch sidebarDestination {
            case .folder(let id): return .folder(id)
            case .tag(let tag): return .tag(tag)
            case .myProfile: return .profile
            case .settings: return .settings
            default: break
            }
            switch selectedTab {
            case .sleevy: return .recents
            case .library: return .library
            case .search: return .search
            }
        } set: { item in
            sidebarPath = []
            switch item {
            case .folder(let id):
                sidebarDestination = .folder(id: id)
            case .tag(let tag):
                sidebarDestination = .tag(tag)
            case .profile:
                sidebarDestination = .myProfile
            case .settings:
                sidebarDestination = .settings
            case .recents:
                sidebarDestination = nil
                selectedTab = .sleevy
                sleevyPath = []
            case .library, nil:
                sidebarDestination = nil
                selectedTab = .library
                libraryPath = []
            case .search:
                sidebarDestination = nil
                selectedTab = .search
            }
        }
    }

    /// Opens the sidebar, unless a Reader View is on screen: it has its own
    /// list of articles beside the article, and on the fold it takes both
    /// pages, so the sidebar steps aside.
    private func resetSidebar() {
        sidebarVisibility = isReading ? .detailOnly : .all
    }

    /// Keeps the reader's place when the window gets wide or narrow. In the
    /// tab bar a Folder or a Tag is pushed on the Library; beside the sidebar
    /// it is the root of the content column.
    private func keepPlace(isWide: Bool) {
        if isWide {
            guard selectedTab == .library, let first = libraryPath.first else { return }
            switch first {
            case .folder, .tag:
                sidebarDestination = first
                sidebarPath = Array(libraryPath.dropFirst())
                libraryPath = []
            default:
                break
            }
        } else if let sidebarDestination {
            selectedTab = .library
            libraryPath = [sidebarDestination] + sidebarPath
            self.sidebarDestination = nil
            sidebarPath = []
        }
    }

    /// Where this Saved Item opens, and the Open recorded either way.
    ///
    /// Reader View when the item has one and the reader has not turned it off;
    /// otherwise the browser, exactly as before the Reader View existed. The
    /// push happens on the stack the tap came from, so the article lands in the
    /// tab the reader was already in.
    private func openItem(
        _ item: SavedItem,
        in sequence: [SavedItem.ID] = [],
        push: @MainActor (AppRoute) -> Void
    ) async {
        guard opensInReader(item, readerViewDisabled: appSettings.isReaderViewDisabled) else {
            await store.markOpened(item)
            return
        }

        push(.reader(id: item.id, sequence: sequence))
        // The same Open Action either way (ADR 0021): reading it here counts as
        // reading it. `recordOpen` skips the browser launch that `markOpened`
        // would do, because the reader is already looking at the article.
        await store.recordOpen(item)
    }

    /// The Move to Folder submenu every row and the Reader View offer.
    private var moveToFolderAction: MoveToFolderAction {
        MoveToFolderAction(folders: store.folders) { item, folder in
            do {
                try await store.move(item, to: folder)
            } catch {
                store.libraryErrorMessage = error.localizedDescription
            }
        }
    }

    private static let deepLinkLogger = Logger(subsystem: "app.sleevy", category: "deep-link")

    /// A widget tap. The Inbox and a Saved Item land on the Home Tab, the
    /// Library and a Folder on the Library Tab. A Saved Item is then
    /// opened through the same Open Action its Inbox row uses, so the read
    /// state and the widget follow.
    private func open(_ link: SleevyDeepLink) async {
        Self.deepLinkLogger.notice("Handling \(link.url.absoluteString, privacy: .public)")

        sidebarDestination = nil
        switch link {
        case .inbox:
            selectedTab = .sleevy
            sleevyPath = []
        case .library:
            selectedTab = .library
            libraryPath = []
        case .folder(let id):
            selectedTab = .library
            if isWide {
                libraryPath = []
                sidebarPath = []
                sidebarDestination = .folder(id: id)
            } else {
                libraryPath = [.folder(id: id)]
            }
        case .savedItem(let id):
            selectedTab = .sleevy
            sleevyPath = []
            await store.loadIfNeeded()
            guard let item = store.savedItem(id: id) else {
                Self.deepLinkLogger.error("No Saved Item \(id, privacy: .public) in the Retrieval Index")
                return
            }
            await openItem(item) { sleevyPath.append($0) }
        }
    }

    private var selectedTabBinding: Binding<AppTab> {
        Binding {
            selectedTab
        } set: { newTab in
            selectedTab = newTab
            resetPath(for: newTab)
        }
    }

    private func handleScenePhaseChange(_ phase: ScenePhase) {
        switch phase {
        case .active:
            guard shouldRefreshAfterActivation else { return }
            shouldRefreshAfterActivation = false

            Task {
                await store.refresh()
            }
        case .inactive, .background:
            shouldRefreshAfterActivation = true
        @unknown default:
            break
        }
    }

    /// Marketing-capture mode opens straight on the screen named by
    /// `SLEEVY_DEMO_SCREEN`, so each App Store screenshot is one launch rather
    /// than a scripted sequence of taps.
    ///
    /// A pushed screen waits for its saves first, as a widget tap on a Saved
    /// Item does. Pushed too early, the Reader View stays on Item Unavailable,
    /// and a Folder View's list grows under its large title and collapses it.
    private func openDemoScreenIfNeeded() async {
        guard let screen = DemoMode.initialScreen else { return }

        switch screen {
        case .inbox:
            selectedTab = .sleevy
        case .library:
            selectedTab = .library
        case .folder:
            selectedTab = .library
            if let folderID = DemoMode.featuredFolderID {
                await store.loadIfNeeded(for: .folder(folderID))
                libraryPath = [.folder(id: folderID)]
            }
        case .profile:
            selectedTab = .sleevy
            sleevyPath = [.myProfile]
        case .search:
            selectedTab = .search
        case .reader:
            selectedTab = .sleevy
            if let itemID = DemoMode.featuredReadableItemID {
                await store.loadIfNeeded()
                sleevyPath = [.reader(id: itemID, sequence: DemoMode.inboxItemIDs)]
            }
        case .tag:
            selectedTab = .library
            await store.loadIfNeeded(for: .completeLibrary)
            libraryPath = [.tag(DemoMode.featuredTag)]
        case .settings:
            selectedTab = .sleevy
            sleevyPath = [.settings]
        case .signIn:
            break
        }
    }

    private func resetPath(for tab: AppTab) {
        switch tab {
        case .sleevy:
            sleevyPath = []
        case .library:
            libraryPath = []
        case .search:
            break
        }
    }
}

private struct AccountToolbarModifier: ViewModifier {
    @Environment(AuthStore.self) private var authStore
    let session: AppSession
    let onSettings: () -> Void
    let onMyProfile: () -> Void

    func body(content: Content) -> some View {
        content
            .toolbarPreferringVerticalBar {
                // Top-bar trailing, while a screen's own items are primary
                // actions: that puts the profile first in the vertical bar.
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            onMyProfile()
                        } label: {
                            Label("My Profile", systemImage: "person.crop.circle")
                        }

                        Button {
                            onSettings()
                        } label: {
                            Label("Settings", systemImage: "gearshape")
                        }

                        Divider()

                        Button(role: .destructive) {
                            Task {
                                await authStore.signOut()
                            }
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        AccountAvatarButton(
                            name: session.displayName,
                            imageURL: session.provider == .google ? authStore.googleUserProfile?.imageURL : nil
                        )
                    }
                    .accessibilityLabel("\(session.displayName) account")
                }
            }
    }
}

extension View {
    func accountToolbar(
        session: AppSession,
        onSettings: @escaping () -> Void,
        onMyProfile: @escaping () -> Void
    ) -> some View {
        modifier(AccountToolbarModifier(session: session, onSettings: onSettings, onMyProfile: onMyProfile))
    }
}

