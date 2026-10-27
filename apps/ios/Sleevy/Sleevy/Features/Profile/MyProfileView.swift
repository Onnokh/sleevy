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
    let authorAvatarUrl: String?
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
    private(set) var activity: ReadingActivity?
    private(set) var isLoadingMore = false
    private var page = 0
    private var totalPages = 1

    func load() async {
        if DemoMode.isEnabled {
            handle = DemoMode.profile.handle
            profile = DemoMode.publicProfile
            items = DemoMode.publicSavedItems
            activity = DemoMode.readingActivity
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
            activity = nil
            page = 0
            totalPages = 1
        }

        self.handle = handle
        if profile == nil { phase = .loading }

        do {
            async let profileFetch: PublicProfile = Self.get("/v1/public/profiles/\(handle)")
            async let itemsFetch: PublicSavedItemsPage = Self.get("/v1/public/profiles/\(handle)/saved-items")
            // The grid is an extra: without it the page still stands.
            async let activityFetch: ReadingActivity? = try? Self.get("/v1/public/profiles/\(handle)/activity")

            let (profile, firstPage) = try await (profileFetch, itemsFetch)

            self.profile = profile
            activity = await activityFetch ?? activity
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
///
/// Set like the Reader View, in one column at its measure and in the face
/// the reader picked: the page is a list of things to read.
@MainActor
struct MyProfileView: View {
    @Environment(PublicProfileLoader.self) private var loader
    @Environment(ProfileStore.self) private var profileStore
    @Environment(AuthStore.self) private var authStore
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let session: AppSession
    @State private var isPublicizing = false
    @State private var isChangingHandle = false
    @State private var isTurningOff = false
    @State private var visibilityError: String?
    @AppStorage("readerFont", store: SleevyUserPreferences.defaults)
    private var font = ReaderFont.serif

    /// A size up where the screen is wide, as in the Reader View.
    private var type: ReaderType {
        ReaderType(bodySize: horizontalSizeClass == .regular ? 19 : 18, font: font)
    }

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

                        // Seldom wanted, so it waits here and not on the page.
                        // One tap hides the page, as on the web, and the
                        // handle stays reserved.
                        if profileStore.isPublic {
                            Button(action: makePrivate) {
                                Label("Make Private", systemImage: "lock")
                            }
                            .disabled(isTurningOff)
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
                // The header ends as a card does, so the first month heading
                // has the same space above it as every other one.
                header
                    .padding(.top, 8)
                    .padding(.bottom, type.cardPadding)
                    .readerColumn(type)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            if profileStore.isPublic {
                publicContent
            }
        }
        .listStyle(.plain)
        .groupedSavesList()
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
                    .font(.system(size: type.metaSize))
                    .foregroundStyle(.secondary)
                    .readerColumn(type)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            ForEach(monthSections, id: \.title) { section in
                Section {
                    // Nearer its first card than the card before it, so it
                    // reads as the start of a group and not the end of one.
                    Text(section.title)
                        .font(.system(size: type.headingSize, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .accessibilityAddTraits(.isHeader)
                        .readerColumn(type)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    ForEach(section.items) { item in
                        PublicSavedItemCard(item: item, type: type)
                            .readerColumn(type)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .task {
                                await loader.loadMoreIfNeeded(current: item)
                            }
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

    /// Who the page is, where the reader's article title would be: the
    /// newest images as a cover, with the avatar and the handle over its
    /// foot, then the facts and the year's Reading Activity. A private page
    /// says so instead, and offers the step that makes it public.
    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            identity

            if profileStore.isPublic {
                publicFacts

                if let activity = loader.activity, let handle = profileStore.profile?.handle {
                    ReadingActivityBars(activity: activity, handle: handle)
                        .frame(height: 36)
                        .padding(.top, type.line)
                }
            } else {
                Text("Private")
                    .font(.system(size: type.smallSize))
                    .foregroundStyle(.secondary)
                    .padding(.top, 10)

                privateNote
                    .padding(.top, type.line * 0.75)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The avatar and the handle, over the foot of the cover where there is
    /// one.
    @ViewBuilder
    private var identity: some View {
        let images = coverImages
        if images.isEmpty {
            nameplate
        } else {
            ZStack(alignment: .bottomLeading) {
                ProfileCover(images: images, tileSize: (type.measure / 3).rounded(.up))
                nameplate
                    .padding(.horizontal, 4)
            }
        }
    }

    private var nameplate: some View {
        HStack(spacing: 12) {
            ProfileAvatar(
                name: session.displayName,
                imageURL: session.provider == .google ? authStore.googleUserProfile?.imageURL : nil
            )
            // A ring in the page color lifts the avatar off the cover.
            .overlay { Circle().strokeBorder(Color(.systemBackground), lineWidth: 3) }

            if let handle = profileStore.profile?.handle {
                Text("@\(handle)")
                    .font(.system(size: type.handleSize, weight: .bold, design: type.font.design))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
    }

    /// The newest items' images in whole rows of three, at most two rows.
    /// None where there are fewer than three: a cover with gaps looks broken.
    private var coverImages: [URL] {
        let images = loader.items.compactMap { $0.imageUrl.flatMap(URL.init(string:)) }.prefix(6)
        return Array(images.prefix(images.count / 3 * 3))
    }

    /// The count and the join date, then the address a visitor types, which
    /// shares the page from here.
    @ViewBuilder
    private var publicFacts: some View {
        if let profile = loader.profile {
            Text("\(profile.publicSavedItemCount) Sleeved · Joined \(profile.joinedAt.formatted(.dateTime.month(.abbreviated).year()))")
                .font(.system(size: type.smallSize))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.top, 10)
        }

        if let handle = profileStore.profile?.handle {
            ShareLink(item: HandleRules.publicProfileURL(handle: handle)) {
                HStack(spacing: 4) {
                    Image(systemName: "globe")
                        .font(.system(size: type.smallSize - 2))
                    Text(HandleRules.displayProfileURL(handle: handle))
                        .font(.system(size: type.smallSize))
                        .lineLimit(1)
                }
                .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
        }
    }

    private var privateNote: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(
                profileStore.profile == nil
                    ? "Choose a handle to hold your page address. Your handle is yours from that moment, and your profile stays private until you make it public yourself."
                    : "Nobody can reach this address, and your handle stays reserved for you."
            )
            .font(.system(size: type.metaSize))
            .lineSpacing(type.metaSize * 0.25)
            .foregroundStyle(.secondary)

            Button {
                isPublicizing = true
            } label: {
                Text("Make Public")
                    .font(.system(size: type.metaSize, weight: .semibold))
                    .padding(.horizontal, 4)
            }
            .buttonStyle(.prominent)
            .buttonBorderShape(.capsule)
            .padding(.top, type.line * 0.75)
        }
    }

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
private let profileAvatarSize: CGFloat = 56

/// The circular avatar at the top of the profile.
private struct ProfileAvatar: View {
    let name: String
    let imageURL: URL?
    var size = profileAvatarSize

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
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var monogram: some View {
        Text(name.initials)
            .font(.system(size: (size * 0.34).rounded(), weight: .semibold))
            .foregroundStyle(.secondary)
    }
}

/// The newest images, three to a row, fading into the page at the foot so
/// the handle over it stays readable. An image that cannot load leaves its
/// tile blank, not a hole.
private struct ProfileCover: View {
    let images: [URL]
    /// At least the widest a tile is drawn, so each image fills its tile.
    let tileSize: CGFloat

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 3), spacing: 3) {
            ForEach(Array(images.enumerated()), id: \.offset) { _, url in
                Color(.secondarySystemBackground)
                    .aspectRatio(1, contentMode: .fit)
                    .overlay { ProfileThumbnail(url: url, size: tileSize, shape: Rectangle()) }
                    .clipped()
            }
        }
        .clipShape(.rect(cornerRadius: 20, style: .continuous))
        .overlay {
            LinearGradient(
                stops: [
                    .init(color: Color(.systemBackground).opacity(0), location: 0.2),
                    .init(color: Color(.systemBackground).opacity(0.85), location: 0.8),
                    .init(color: Color(.systemBackground), location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Layout

/// The Public Profile's sizes, from the reader's, so the page and the
/// Reader View share one scale.
extension ReaderType {
    /// Where a card is from and what it says: a step under the meta size, so
    /// the title leads.
    var smallSize: CGFloat { metaSize - 1 }

    /// The handle: a step over the article title, since it is the title of
    /// the whole page.
    var handleSize: CGFloat { (titleSize * 1.15).rounded() }

    /// A month over its cards: smaller than the cards' own labels, and bold
    /// to make up for it.
    var headingSize: CGFloat { metaSize - 2 }

    /// Above and below a card's content: half a line, so cards are a line
    /// apart.
    var cardPadding: CGFloat { (line / 2).rounded() }

    /// The byline a card opens with, the site or the Link Author: one height
    /// for a favicon and for an avatar, so a Post Card's text starts where a
    /// Link Card's title does.
    var bylineHeight: CGFloat { smallSize + 5 }

    /// Between the byline and the text under it.
    var bylineGap: CGFloat { 5 }

    /// One leading for every line of text on a card, tighter than the Reader
    /// View's prose since a card is read at a glance.
    var cardLineSpacing: CGFloat { (bodySize * 0.12).rounded() }
}

extension View {
    /// One column at the reader's measure, margins included, centred where the
    /// screen is wider. Its rows take no list insets.
    fileprivate func readerColumn(_ type: ReaderType) -> some View {
        padding(.horizontal, 20)
            .frame(maxWidth: type.measure, alignment: .leading)
            .frame(maxWidth: .infinity)
    }
}
