import Foundation

struct AppSession: Codable, Equatable {
    let token: String
    let userId: String
    let email: String
    let name: String
    let provider: AuthProvider?

    var displayName: String {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedName.isEmpty {
            return trimmedName
        }

        if provider == .apple {
            return "Apple account"
        }

        return email
    }

    var providerName: String? {
        provider?.displayName
    }

    /// The owner of a Local Library: no Account, no token.
    static let local = AppSession(
        token: "",
        userId: LocalLibraryFlag.userId,
        email: "",
        name: "On this iPhone",
        provider: nil
    )

    /// Whether this session is a Local Library rather than an Account.
    var isLocal: Bool { userId == LocalLibraryFlag.userId }

    func withProvider(_ provider: AuthProvider?) -> AppSession {
        AppSession(
            token: token,
            userId: userId,
            email: email,
            name: name,
            provider: provider
        )
    }
}

struct AuthSessionResponse: Decodable {
    struct User: Decodable {
        let id: String
        let name: String?
        let email: String
    }

    let user: User
}

struct NativeSocialSignInResponse: Decodable {
    struct User: Decodable {
        let id: String
        let name: String?
        let email: String
    }

    let redirect: Bool
    let token: String?
    let user: User?
    let url: String?
}

struct AuthErrorResponse: Decodable {
    let message: String?
    let error: String?
    let code: String?
}
