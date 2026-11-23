import Foundation
import Observation
import WidgetKit

@MainActor
@Observable
final class AuthStore {
    private(set) var session: AppSession? {
        didSet {
            if let session {
                prepareReadingList(for: session)
                scheduleWidgetRefresh()
            } else {
                readingListStore?.stop()
                readingListStore = nil
                readingListAccountID = nil
                WidgetBackgroundRefresh.cancel()
            }
        }
    }
    private(set) var readingListStore: ReadingListStore?
    /// The Local Library while this device uses Sleevy with no Account.
    private(set) var localLibrary: LocalReadingListAdapter?
    private var readingListAccountID: String?
    private(set) var googleUserProfile: GoogleUserProfile?
    private(set) var isRestoringSession = false
    private(set) var isSigningIn = false
    var errorMessage: String?

    /// The single source of truth for the bearer token, shared with `ReadingListStore`'s
    /// `SleevyAPIClient` so a token rotated on either the auth path or the reading-list
    /// path is seen by both and persisted to the keychain.
    let tokenStore = SessionTokenStore.live(
        keychain: KeychainStore(
            service: AppConfig.keychainService,
            accessGroup: AppConfig.keychainAccessGroup
        ),
        account: AppConfig.keychainTokenAccount
    )
    private let googleSignInClient: any GoogleSignInClient
    private let appleSignInClient: any AppleSignInClient
    private let sharedDefaults = UserDefaults(suiteName: AppConfig.appGroupIdentifier)
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private let api: HTTPClient

    init() {
        self.googleSignInClient = makeGoogleSignInClient()
        self.appleSignInClient = makeAppleSignInClient()
        self.api = Self.makeHTTPClient(encoder: encoder, decoder: decoder)
    }

    init(
        googleSignInClient: any GoogleSignInClient,
        appleSignInClient: (any AppleSignInClient)? = nil
    ) {
        self.googleSignInClient = googleSignInClient
        self.appleSignInClient = appleSignInClient ?? UnimplementedAppleSignInClient()
        self.api = Self.makeHTTPClient(encoder: encoder, decoder: decoder)
    }

    private static func makeHTTPClient(encoder: JSONEncoder, decoder: JSONDecoder) -> HTTPClient {
        HTTPClient(
            baseURL: AppConfig.apiBaseURL,
            origin: AppConfig.apiOrigin,
            session: AppConfig.apiSession,
            encoder: encoder,
            decoder: decoder
        )
    }

    /// The foreground and background share one store, so their sync cycles
    /// cannot drain the same queues or overwrite each other's widget snapshot.
    private func prepareReadingList(for session: AppSession) {
        guard readingListAccountID != session.userId else { return }
        readingListStore?.stop()
        let network: (any ReadingListNetworkPort)?
        if DemoMode.isEnabled {
            network = DemoReadingListAdapter()
        } else if session.isLocal {
            let local = LocalReadingListAdapter()
            localLibrary = local
            network = local
        } else {
            localLibrary = nil
            network = nil
        }
        let store = ReadingListStore(session: session, tokenStore: tokenStore, network: network)
        // An enrichment on the device finished: load the library again.
        localLibrary?.onChange = { [weak store] in
            Task { await store?.refresh() }
        }
        store.onAuthenticationInvalid = { [weak self] message in
            self?.invalidateSession(message: message)
        }
        readingListStore = store
        readingListAccountID = session.userId
    }

    func scheduleWidgetRefresh() {
        guard !DemoMode.isEnabled, session != nil || readCachedSession() != nil else {
            WidgetBackgroundRefresh.cancel()
            return
        }
        WidgetBackgroundRefresh.schedule()
    }

    func refreshWidgetsInBackground() async {
        // Rearm even after an offline attempt or expiry. A background launch
        // can restore the cached Account without starting interactive sign-in.
        scheduleWidgetRefresh()
        guard !DemoMode.isEnabled, !Task.isCancelled,
              !tokenStore.current.isEmpty,
              let session = session ?? readCachedSession() else { return }
        prepareReadingList(for: session)
        await readingListStore?.refreshInBackground()
    }

    func restoreSession() async {
        guard !isRestoringSession else { return }

        // Marketing-capture mode signs in as the demo Account without a token
        // exchange, so screenshots never show a real reader.
        if DemoMode.isEnabled {
            // The `signin` capture shows the signed-out landing instead.
            session = DemoMode.initialScreen == .signIn ? nil : DemoMode.session
            googleUserProfile = nil
            return
        }

        // A Local Library needs no token and no server.
        if LocalLibraryFlag.isOn && tokenStore.current.isEmpty {
            session = .local
            return
        }

        isRestoringSession = true
        errorMessage = nil
        defer { isRestoringSession = false }

        let cachedSession = readCachedSession()

        do {
            let token = tokenStore.current
            guard !token.isEmpty else {
                clearPersistedSession()
                session = nil
                googleUserProfile = nil
                return
            }

            if let cachedSession {
                session = cachedSession
            }

            googleUserProfile = await googleSignInClient.restoreUserProfile()
            prefetchProfileImage(googleUserProfile)
            let restoredSession = try await fetchSession(token: token)
            let sessionProvider = restoredSession.provider ?? cachedSession?.provider
            let displaySession = restoredSession.withProvider(sessionProvider)
            tokenStore.rotate(to: restoredSession.token)
            session = displaySession
            cache(session: displaySession)
            refreshSharedProfileHandle()
        } catch {
            if shouldDiscardSession(for: error) {
                clearPersistedSession()
                session = nil
                googleUserProfile = nil
            } else {
                session = cachedSession
            }

            errorMessage = AppConfig.userFacingNetworkMessage(for: error) ?? error.localizedDescription
        }
    }

    /// Sleevy with no Account: a Local Library on this device. The reader can
    /// connect an Account later; the Local Library is then imported.
    func continueWithoutAccount() {
        errorMessage = nil
        LocalLibraryFlag.isOn = true
        cache(session: .local)
        session = .local
    }

    func signInWithGoogle() async {
        guard !isSigningIn else { return }

        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            let googleTokens = try await googleSignInClient.signIn()
            let session = try await exchangeSocialTokensForSession(
                provider: .google,
                idToken: googleTokens.idToken,
                accessToken: googleTokens.accessToken
            )
            try await importLocalLibraryIfNeeded(token: session.token)
            tokenStore.rotate(to: session.token)
            cache(session: session)
            googleUserProfile = await googleSignInClient.restoreUserProfile()
            prefetchProfileImage(googleUserProfile)
            self.session = session
            refreshSharedProfileHandle()
        } catch {
            errorMessage = AppConfig.userFacingNetworkMessage(for: error) ?? error.localizedDescription
        }
    }

    func signInWithApple() async {
        guard !isSigningIn else { return }

        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            let appleTokens = try await appleSignInClient.signIn()
            let session = try await exchangeSocialTokensForSession(
                provider: .apple,
                idToken: appleTokens.idToken,
                nonce: appleTokens.nonce
            )
            try await importLocalLibraryIfNeeded(token: session.token)
            tokenStore.rotate(to: session.token)
            cache(session: session)
            googleUserProfile = nil
            self.session = session
            refreshSharedProfileHandle()
        } catch {
            errorMessage = AppConfig.userFacingNetworkMessage(for: error) ?? error.localizedDescription
        }
    }

    func signOut() async {
        let token = currentToken
        session = nil
        googleUserProfile = nil
        errorMessage = nil
        clearPersistedSession()

        guard let token else {
            googleSignInClient.signOut()
            return
        }

        _ = try? await api.send("/api/auth/sign-out", method: .post, token: token)
        googleSignInClient.signOut()
    }

    func invalidateSession(message: String = "Your Sleevy session expired. Please sign in again.") {
        session = nil
        googleUserProfile = nil
        errorMessage = message
        clearPersistedSession()
        googleSignInClient.signOut()
    }

    func deleteAccount() async throws {
        guard let token = currentToken else {
            throw AuthError.sessionExpired
        }

        do {
            _ = try await api.send("/api/auth/delete-user", method: .post, token: token, httpBody: Data("{}".utf8))
        } catch let APIClientError.unacceptableStatus(_, data) {
            throw authError(from: data, fallback: .invalidServerResponse)
        } catch APIClientError.invalidResponse {
            throw AuthError.invalidServerResponse
        }

        session = nil
        googleUserProfile = nil
        errorMessage = nil
        clearPersistedSession()
        googleSignInClient.signOut()
    }

    /// Connecting an Account from a Local Library: the Local Library goes
    /// into the Account first, with the summaries and Tags made on the
    /// device; the server does not enrich it again. Only when that worked
    /// does the app switch to the Account and erase the Local Library. If it
    /// fails, the reader stays in the Local Library and nothing is lost.
    private func importLocalLibraryIfNeeded(token: String) async throws {
        guard session?.isLocal == true, let localLibrary else { return }
        let library = localLibrary.snapshot
        let folders = library.folders.map {
            LocalLibraryImport.Folder(name: $0.name, emoji: $0.emoji, color: $0.color)
        }
        let items = library.items.map(LocalLibraryImport.Item.init)
        // The API takes at most 500 saves in one request.
        var start = 0
        repeat {
            let batch = Array(items[start..<min(start + 500, items.count)])
            do {
                _ = try await api.send(
                    "/v1/saved-items/import",
                    method: .post,
                    token: token,
                    body: LocalLibraryImport(folders: start == 0 ? folders : [], items: batch)
                )
            } catch {
                throw AuthError.authenticationFailed(
                    "Sleevy could not move your saves to the Account. Your saves are still on this iPhone. Try again."
                )
            }
            start += 500
        } while start < items.count

        localLibrary.erase()
        self.localLibrary = nil
        LocalLibraryFlag.isOn = false
    }

    private func exchangeSocialTokensForSession(
        provider: AuthProvider,
        idToken: String,
        accessToken: String? = nil,
        nonce: String? = nil
    ) async throws -> AppSession {
        let response: APIResponse
        do {
            response = try await api.send(
                "/api/auth/sign-in/social",
                method: .post,
                body: NativeSocialSignInRequest(
                    provider: provider.rawValue,
                    disableRedirect: true,
                    idToken: .init(
                        token: idToken,
                        accessToken: accessToken,
                        nonce: nonce
                    )
                )
            )
        } catch let APIClientError.unacceptableStatus(_, data) {
            throw authError(from: data, fallback: .invalidServerResponse)
        } catch APIClientError.invalidResponse {
            throw AuthError.invalidServerResponse
        }

        let payload = try decoder.decode(NativeSocialSignInResponse.self, from: response.data)
        if payload.redirect {
            if let url = payload.url, !url.isEmpty {
                throw AuthError.authenticationFailed("The server tried to start a browser redirect instead of returning a native session.")
            }
            throw AuthError.invalidTokenExchangeResponse
        }

        guard
            let token = bearerToken(from: response.http) ?? payload.token,
            let user = payload.user
        else {
            throw AuthError.invalidTokenExchangeResponse
        }
        return AppSession(
            token: token,
            userId: user.id,
            email: user.email,
            name: normalizedName(user.name),
            provider: provider
        )
    }

    private func fetchSession(token: String) async throws -> AppSession {
        let response: APIResponse
        do {
            response = try await api.send("/api/auth/get-session", token: token)
        } catch let APIClientError.unacceptableStatus(code, data) {
            if code == 401 || code == 403 {
                throw AuthError.sessionExpired
            }
            throw authError(from: data, fallback: .invalidServerResponse)
        } catch APIClientError.invalidResponse {
            throw AuthError.invalidServerResponse
        }

        let payload = try decoder.decode(AuthSessionResponse.self, from: response.data)
        return AppSession(
            token: bearerToken(from: response.http) ?? token,
            userId: payload.user.id,
            email: payload.user.email,
            name: normalizedName(payload.user.name),
            provider: nil
        )
    }

    private func normalizedName(_ name: String?) -> String {
        name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private func bearerToken(from response: HTTPURLResponse) -> String? {
        guard
            let token = response.value(forHTTPHeaderField: "set-auth-token")?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !token.isEmpty
        else {
            return nil
        }

        return token
    }

    private func authError(from data: Data, fallback: AuthError) -> AuthError {
        guard
            let payload = try? JSONDecoder().decode(AuthErrorResponse.self, from: data),
            let message = payload.message ?? payload.error,
            !message.isEmpty
        else {
            return fallback
        }

        return .authenticationFailed(message)
    }

    private func readCachedSession() -> AppSession? {
        guard
            let data = sharedDefaults?.data(forKey: AppConfig.sharedAppSessionKey)
        else {
            return nil
        }

        return try? decoder.decode(AppSession.self, from: data)
    }

    private func cache(session: AppSession) {
        guard let data = try? encoder.encode(session) else { return }
        sharedDefaults?.set(data, forKey: AppConfig.sharedAppSessionKey)
    }

    private func prefetchProfileImage(_ profile: GoogleUserProfile?) {
        guard let imageURL = profile?.imageURL else { return }

        Task.detached(priority: .background) {
            _ = try? await RemoteImageDiskCache.shared.data(for: imageURL)
        }
    }

    /// The active bearer token, or `nil` when there is none. Prefers the
    /// in-memory session token, falling back to the store (which survives an app
    /// relaunch via the keychain).
    private var currentToken: String? {
        if let sessionToken = session?.token, !sessionToken.isEmpty {
            return sessionToken
        }
        let stored = tokenStore.current
        return stored.isEmpty ? nil : stored
    }

    private func clearPersistedSession() {
        tokenStore.clear()
        sharedDefaults?.removeObject(forKey: AppConfig.sharedAppSessionKey)

        if SleevyUserPreferences.profileHandle != nil {
            SleevyUserPreferences.profileHandle = nil
            WidgetCenter.shared.reloadTimelines(ofKind: "ReadingActivityWidget")
        }

        // The Unread Widget shows what the app last published; a signed-out
        // device must not keep showing the previous account's Inbox.
        if UnreadBacklogSnapshot.load() != nil {
            UnreadBacklogSnapshot.clear()
            WidgetCenter.shared.reloadTimelines(ofKind: UnreadBacklogSnapshot.widgetKind)
        }
    }

    /// The activity widget keys the public activity endpoint by profile
    /// handle, which the session payload does not carry. Fetch it in the
    /// background and share it through the app group; the widget follows the
    /// signed-in account without holding credentials of its own.
    private func refreshSharedProfileHandle() {
        Task {
            let token = tokenStore.current
            guard !token.isEmpty else { return }

            guard
                let response = try? await api.send("/v1/profile", token: token),
                let profile = try? decoder.decode(ProfileHandleResponse.self, from: response.data)
            else { return }

            // Mirror a rotated `set-auth-token` like every other authed call.
            if
                let rotated = response.http.value(forHTTPHeaderField: "set-auth-token")?
                    .trimmingCharacters(in: .whitespacesAndNewlines),
                !rotated.isEmpty
            {
                tokenStore.rotate(to: rotated)
            }

            SleevyUserPreferences.profileHandle = profile.handle

            // Reload on every fetch, not only on a changed handle: the grid
            // itself moves daily, and a reload here is once per app launch.
            WidgetCenter.shared.reloadTimelines(ofKind: "ReadingActivityWidget")
        }
    }

    private func shouldDiscardSession(for error: Error) -> Bool {
        guard let authError = error as? AuthError else { return false }

        switch authError {
        case .sessionExpired:
            return true
        default:
            return false
        }
    }
}

private struct NativeSocialSignInRequest: Encodable {
    let provider: String
    let disableRedirect: Bool
    let idToken: IdTokenPayload

    struct IdTokenPayload: Encodable {
        let token: String
        let accessToken: String?
        let nonce: String?
    }
}

/// The slice of `GET /v1/profile` the shared handle needs.
private struct ProfileHandleResponse: Decodable {
    let handle: String
}

/// The body of `POST /v1/saved-items/import`: a Local Library as it is.
private struct LocalLibraryImport: Encodable {
    struct Folder: Encodable {
        let name: String
        let emoji: String?
        let color: String?
    }

    struct Item: Encodable {
        let url: String
        let title: String?
        let description: String?
        let siteName: String?
        let faviconUrl: String?
        let previewSummary: String?
        let tags: [String]
        let isRead: Bool
        let savedAt: String
        let folderName: String?

        init(_ item: SavedItem) {
            url = item.originalURL
            title = item.title
            description = item.description
            siteName = item.siteName
            faviconUrl = item.faviconURL
            previewSummary = item.previewSummary
            tags = item.tags
            isRead = item.isRead
            savedAt = item.lastSavedAt.formatted(.iso8601)
            folderName = item.folder?.name
        }
    }

    let folders: [Folder]
    let items: [Item]
}
