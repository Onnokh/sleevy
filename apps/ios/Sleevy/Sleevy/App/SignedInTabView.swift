import os
import SwiftUI

/// The signed-in shell: the tab bar, one navigation stack per stackable tab, and
/// the single `navigationDestination(for: AppRoute.self)` that resolves every
/// push destination through `AppRoute.destination`.
struct SignedInTabView: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(DeepLinkStore.self) private var deepLinks
    @Environment(\.scenePhase) private var scenePhase
    let session: AppSession
    @State private var store: ReadingListStore
    @State private var profileLoader = PublicProfileLoader()
    @State private var profileStore: ProfileStore
    @State private var selectedTab: AppTab = .sleevy
    @State private var sleevyPath: [AppRoute] = []
    @State private var libraryPath: [AppRoute] = []
    @State private var shouldRefreshAfterActivation = false

    init(session: AppSession, tokenStore: SessionTokenStore) {
        self.session = session
        _store = State(
            wrappedValue: ReadingListStore(
                session: session,
                tokenStore: tokenStore,
                network: DemoMode.isEnabled ? DemoReadingListAdapter() : nil
            )
        )
        _profileStore = State(
            wrappedValue: DemoMode.isEnabled ? ProfileStore.demo() : ProfileStore.live(tokenStore: tokenStore)
        )
    }

    var body: some View {
        TabView(selection: selectedTabBinding) {
            Tab("Home", systemImage: "house", value: AppTab.sleevy) {
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
                        .environment(\.pushRoute) { sleevyPath.append($0) }
                }
            }

            Tab("Library", systemImage: "rectangle.stack.fill", value: AppTab.library) {
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
                        .environment(\.pushRoute) { libraryPath.append($0) }
                }
            }

            Tab(value: AppTab.search, role: .search) {
                NavigationStack {
                    SearchView(store: store)
                }
            }
        }
        .environment(profileLoader)
        .environment(profileStore)
        .task {
            // Folder cards suppress their published marker while the profile
            // is private, so the record must be known outside the profile page.
            await profileStore.load()
            openDemoScreenIfNeeded()
        }
        .onAppear {
            store.onAuthenticationInvalid = { message in
                authStore.invalidateSession(message: message)
            }
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

    private static let deepLinkLogger = Logger(subsystem: "app.sleevy", category: "deep-link")

    /// A widget tap. The Inbox and a Saved Item land on the Home Tab, the
    /// Library and a Folder on the Library Tab. A Saved Item is then
    /// opened through the same Open Action its Inbox row uses, so the read
    /// state and the widget follow.
    private func open(_ link: SleevyDeepLink) async {
        Self.deepLinkLogger.notice("Handling \(link.url.absoluteString, privacy: .public)")

        switch link {
        case .inbox:
            selectedTab = .sleevy
            sleevyPath = []
        case .library:
            selectedTab = .library
            libraryPath = []
        case .folder(let id):
            selectedTab = .library
            libraryPath = [.folder(id: id)]
        case .savedItem(let id):
            selectedTab = .sleevy
            sleevyPath = []
            await store.loadIfNeeded()
            guard let item = store.savedItem(id: id) else {
                Self.deepLinkLogger.error("No Saved Item \(id, privacy: .public) in the Retrieval Index")
                return
            }
            await store.markOpened(item)
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
    private func openDemoScreenIfNeeded() {
        guard let screen = DemoMode.initialScreen else { return }

        switch screen {
        case .inbox:
            selectedTab = .sleevy
        case .library:
            selectedTab = .library
        case .folder:
            selectedTab = .library
            if let folderID = DemoMode.featuredFolderID {
                libraryPath = [.folder(id: folderID)]
            }
        case .profile:
            selectedTab = .sleevy
            sleevyPath = [.myProfile]
        case .search:
            selectedTab = .search
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
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
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
