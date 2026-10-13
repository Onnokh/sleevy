import SwiftUI
import UIKit

// MARK: - Contract

/// Mirror of `GET /v1/public/profiles/:handle` (`PublicProfileDto`).
nonisolated struct PublicProfile: Decodable {
    let handle: String
    let joinedAt: Date
    let publicSavedItemCount: Int
    let isIndexable: Bool
}

/// Mirror of one entry of `GET /v1/public/profiles/:handle/saved-items`
/// (`PublicSavedItemDto`). A profile publishes a Link at most once, so the
/// original URL identifies the row.
nonisolated struct PublicSavedItem: Decodable, Identifiable, Equatable {
    let originalUrl: String
    let host: String
    let title: String?
    let faviconUrl: String?
    let imageUrl: String?
    let authorName: String?
    let authorHandle: String?
    let type: String
    let tags: [String]
    let previewSummary: String?
    let savedAt: Date

    var id: String { originalUrl }
}

nonisolated private struct PublicSavedItemsPage: Decodable {
    let savedItems: [PublicSavedItem]
    let page: Int
    let pageSize: Int
    let totalPages: Int
}

// MARK: - Loader

/// Loads the signed-in account's Public Profile through the same public
/// endpoints the web page uses, keyed by the handle the app shares through
/// the app group at sign-in. No credentials are involved: this page shows
/// exactly what a visitor of /u/{handle} sees.
///
/// One instance lives in `SignedInTabView` and reaches the page through the
/// environment, so content survives pops of the profile page: revisits show
/// the cached page immediately while `load()` revalidates behind it.
@MainActor
@Observable
final class PublicProfileLoader {
    enum Phase: Equatable {
        case loading
        case loaded
        case missingHandle
        case unavailable
    }

    private(set) var phase = Phase.loading
    private(set) var handle: String?
    private(set) var profile: PublicProfile?
    private(set) var items: [PublicSavedItem] = []
    private(set) var isLoadingMore = false
    private var page = 0
    private var totalPages = 1

    func load() async {
        if DemoMode.isEnabled {
            handle = DemoMode.profile.handle
            profile = DemoMode.publicProfile
            items = DemoMode.publicSavedItems
            phase = .loaded
            return
        }

        guard let handle = SleevyUserPreferences.profileHandle else {
            phase = .missingHandle
            return
        }

        // Content cached for another handle (a rename, or a different account
        // after re-sign-in) must not flash before the fresh fetch.
        if handle != self.handle {
            profile = nil
            items = []
            page = 0
            totalPages = 1
        }

        self.handle = handle
        if profile == nil { phase = .loading }

        do {
            async let profileFetch: PublicProfile = Self.get("/v1/public/profiles/\(handle)")
            async let itemsFetch: PublicSavedItemsPage = Self.get("/v1/public/profiles/\(handle)/saved-items")

            let (profile, firstPage) = try await (profileFetch, itemsFetch)

            self.profile = profile
            items = firstPage.savedItems
            page = firstPage.page
            totalPages = firstPage.totalPages
            phase = .loaded
        } catch {
            // The endpoint answers a private profile with the same not-found
            // it gives an unknown handle, so both land here.
            if profile == nil { phase = .unavailable }
        }
    }

    func loadMoreIfNeeded(current item: PublicSavedItem) async {
        guard
            item.id == items.last?.id,
            page < totalPages,
            !isLoadingMore
        else { return }

        guard let handle else { return }

        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let next: PublicSavedItemsPage = try await Self.get(
                "/v1/public/profiles/\(handle)/saved-items",
                query: [URLQueryItem(name: "page", value: String(page + 1))]
            )
            let known = Set(items.map(\.id))
            items.append(contentsOf: next.savedItems.filter { !known.contains($0.id) })
            page = next.page
            totalPages = next.totalPages
        } catch {
            // A failed page keeps the current list; scrolling retries.
        }
    }

    private static func get<Response: Decodable>(
        _ path: String,
        query: [URLQueryItem] = []
    ) async throws -> Response {
        var components = URLComponents(
            url: AppConfig.apiBaseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty { components?.queryItems = query }

        guard let url = components?.url else { throw URLError(.badURL) }

        var request = URLRequest(url: url)
        request.httpShouldHandleCookies = false

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder.sharedISO8601.decode(Response.self, from: data)
    }
}

// MARK: - View

/// The in-app twin of the web's /u/{handle} page: the sleeved count, the
/// member-since date, the Reading Activity grid, and the published Saved
/// Items grouped by month.
@MainActor
struct MyProfileView: View {
    @Environment(PublicProfileLoader.self) private var loader
    @Environment(ProfileStore.self) private var profileStore
    @Environment(AuthStore.self) private var authStore
    @Environment(\.colorScheme) private var colorScheme
    let session: AppSession
    @State private var isPublicizing = false
    @State private var isChangingHandle = false
    @State private var isTurningOff = false
    @State private var visibilityError: String?

    var body: some View {
        Group {
            switch profileStore.phase {
            case .loading:
                ProgressView("Loading your profile...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed:
                ContentUnavailableView(
                    "Could Not Load Your Profile",
                    systemImage: "person.crop.circle.badge.exclamationmark",
                    description: Text("Could not load your public profile. Pull to retry.")
                )
            case .loaded:
                profileList
            }
        }
        .background(Color(.systemBackground))
        // No navigation title: the avatar and the handle carry the identity.
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if profileStore.profile != nil {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        // A private page has no address a visitor can reach,
                        // so there is nothing to share until it is public.
                        if profileStore.isPublic, let handle = profileStore.profile?.handle {
                            ShareLink(item: HandleRules.publicProfileURL(handle: handle)) {
                                Label("Share Profile", systemImage: "square.and.arrow.up")
                            }
                        }

                        Button {
                            isChangingHandle = true
                        } label: {
                            Label("Change Handle", systemImage: "at")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Profile Options")
                }
            }
        }
        .sheet(isPresented: $isPublicizing) {
            PublicizeProfileSheet(profileStore: profileStore) {
                await loader.load()
            }
        }
        .sheet(isPresented: $isChangingHandle) {
            ChangeHandleSheet(profileStore: profileStore)
        }
        .alert(
            "Could Not Update Your Profile",
            isPresented: Binding(
                get: { visibilityError != nil },
                set: { if !$0 { visibilityError = nil } }
            ),
            presenting: visibilityError
        ) { _ in
            Button("OK", role: .cancel) {}
        } message: { message in
            Text(message)
        }
        .task {
            await load()
        }
        .refreshable {
            await load()
        }
    }

    /// The authed profile record decides the page's shape; the public content
    /// only exists (and is only fetched) while Profile Visibility is public.
    private func load() async {
        await profileStore.load()
        if profileStore.isPublic {
            await loader.load()
        }
    }

    private var profileList: some View {
        List {
            Section {
                VStack(spacing: 6) {
                    ProfileAvatar(
                        name: session.displayName,
                        imageURL: session.provider == .google ? authStore.googleUserProfile?.imageURL : nil
                    )
                    .padding(.bottom, 8)

                    if let handle = profileStore.profile?.handle {
                        Text("@\(handle)")
                            .font(.system(size: 24, weight: .bold))
                    }

                    if profileStore.isPublic, let count = loader.profile?.publicSavedItemCount {
                        Text("\(count) Sleeved")
                            .font(.system(size: 15))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 14, trailing: 20))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

                Button(action: handleVisibilityTap) {
                    Text(visibilityButtonTitle)
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.prominent)
                .controlSize(.large)
                .disabled(isTurningOff)
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
                .listRowInsets(EdgeInsets(top: 4, leading: 24, bottom: 16, trailing: 24))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            if profileStore.isPublic {
                publicContent
            } else {
                Section {
                    privateStateView
                        .listRowInsets(EdgeInsets(top: 0, leading: 24, bottom: 0, trailing: 24))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollBounceBehavior(.always, axes: .vertical)
        // Favicons warm as soon as items arrive, off the scroll path.
        .task(id: loader.items) {
            await FaviconPrefetcher.warm(
                urls: loader.items.map { $0.faviconUrl.flatMap(URL.init(string:)) },
                colorScheme: colorScheme
            )
        }
    }

    /// The published Saved Items, or the transitional states around them —
    /// only rendered while Profile Visibility is public.
    @ViewBuilder
    private var publicContent: some View {
        switch loader.phase {
        case .loading, .missingHandle:
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        case .unavailable:
            Text("Could not load your page. Pull to retry.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        case .loaded:
            if loader.items.isEmpty {
                Text("Nothing here yet. Publish a folder from its menu, and everything in it shows on your page.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .listRowInsets(EdgeInsets(top: 0, leading: 24, bottom: 0, trailing: 24))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            ForEach(monthSections, id: \.title) { section in
                ListGroupHeading(title: section.title)

                ForEach(section.items) { item in
                    PublicSavedItemRow(item: item)
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .task {
                            await loader.loadMoreIfNeeded(current: item)
                        }
                }
            }

            if loader.isLoadingMore {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }
        }
    }

    private var privateStateView: some View {
        VStack(spacing: 12) {
            Image(systemName: "lock")
                .font(.system(size: 26, weight: .medium))
                .foregroundStyle(.secondary)

            Text(
                profileStore.profile == nil
                    ? "Choose a handle to hold your page address. Your handle is yours from that moment, and your profile stays private until you make it public yourself."
                    : "Private. Nobody can reach this address, and your handle stays reserved for you."
            )
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
    }

    private var visibilityButtonTitle: String {
        if isTurningOff { return "Turning Off…" }
        return profileStore.isPublic ? "Make Private" : "Make Public"
    }

    private func handleVisibilityTap() {
        if profileStore.isPublic {
            makePrivate()
        } else {
            isPublicizing = true
        }
    }

    /// Turning the page off is never gated, mirroring the web: one tap hides
    /// it, and the handle stays reserved.
    private func makePrivate() {
        Task {
            isTurningOff = true
            defer { isTurningOff = false }
            do {
                try await profileStore.setVisibility(.private)
            } catch {
                visibilityError = error.localizedDescription
            }
        }
    }

    private struct MonthSection {
        let title: String
        let items: [PublicSavedItem]
    }

    /// The published items grouped into "August 2026"-style sections, newest
    /// month first; the API already orders items newest first within it.
    private var monthSections: [MonthSection] {
        var sections: [MonthSection] = []
        var currentKey: String?

        for item in loader.items {
            let title = item.savedAt.formatted(.dateTime.month(.wide).year())
            if title != currentKey {
                sections.append(MonthSection(title: title, items: []))
                currentKey = title
            }
            sections[sections.count - 1] = MonthSection(
                title: title,
                items: sections[sections.count - 1].items + [item]
            )
        }

        return sections
    }
}

// MARK: - Header pieces

/// The avatar's diameter.
private let profileAvatarSize: CGFloat = 88

/// The circular avatar at the top of the profile.
private struct ProfileAvatar: View {
    let name: String
    let imageURL: URL?

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(uiColor: .tertiarySystemFill))

            if let imageURL {
                AsyncImage(url: imageURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    monogram
                }
            } else {
                monogram
            }
        }
        .frame(width: profileAvatarSize, height: profileAvatarSize)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var monogram: some View {
        Text(name.initials)
            .font(.system(size: 30, weight: .semibold))
            .foregroundStyle(.secondary)
    }
}


// MARK: - Item row

/// The Inbox row's twin: the favicon and the title on one line, so the
/// profile page reads like the rest of the app. Only the actions differ — a
/// public item just opens, copies, or shares.
private struct PublicSavedItemRow: View {
    let item: PublicSavedItem

    var body: some View {
        Button {
            guard let url = URL(string: item.originalUrl) else { return }
            UIApplication.shared.open(url)
        } label: {
            HStack(spacing: 12) {
                SavedItemFavicon(
                    faviconURL: item.faviconUrl.flatMap(URL.init(string:)),
                    monogram: String(displayHost.prefix(1)).uppercased(),
                    size: 26
                )
                .clipShape(.rect(cornerRadius: 6, style: .continuous))

                Text(item.title ?? item.originalUrl)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .contentShape(Rectangle())
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .contextMenu {
            if let url = URL(string: item.originalUrl) {
                ShareLink(item: url, preview: SharePreview(item.title ?? item.host)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }

                Button {
                    UIPasteboard.general.url = url
                } label: {
                    Label("Copy Link", systemImage: "link")
                }
            }
        }
    }

    private var displayHost: String {
        item.host.replacingOccurrences(
            of: #"^www\."#,
            with: "",
            options: .regularExpression
        )
    }
}
