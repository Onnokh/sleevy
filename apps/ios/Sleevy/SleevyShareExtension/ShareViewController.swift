import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private static let appGroupIdentifier = SleevyUserPreferences.appGroupIdentifier
    private static let keychainService = "app.sleevy"
    private static let keychainAccessGroup = Bundle.main.object(forInfoDictionaryKey: "SleevyKeychainAccessGroup") as? String
    private static let authTokenAccount = "auth-token"
    private static let sharedAppSessionKey = "app-session"
    private static var sourceName: String {
        SleevyUserPreferences.sourceName
    }
    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()
    private static let apiSession: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = false
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 15
        return URLSession(configuration: configuration)
    }()
    private let model = ShareSaveModel()
    private var hasStarted = false
    private var captureClient: SleevyCaptureClient {
        SleevyCaptureClient(
            apiBaseURL: SleevyAPIEnvironment.baseURL,
            apiOrigin: SleevyAPIEnvironment.origin,
            urlSession: Self.apiSession,
            encoder: Self.encoder,
            decoder: Self.decoder
        )
    }
    private let pendingCaptureStore = SleevyPendingCaptureStore(
        appGroupIdentifier: ShareViewController.appGroupIdentifier
    )
    private let keychain = KeychainStore(
        service: ShareViewController.keychainService,
        accessGroup: ShareViewController.keychainAccessGroup
    )

    /// Dark from the first frame, the glass's own ground, so the sheet never
    /// opens light before the glass is drawn.
    override func loadView() {
        let ground = UIView()
        ground.backgroundColor = UIColor(red: 8 / 255, green: 9 / 255, blue: 12 / 255, alpha: 1)
        view = ground
        overrideUserInterfaceStyle = .dark
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let save = UIHostingController(rootView: ShareSaveView(model: model) { [weak self] in
            self?.extensionContext?.cancelRequest(withError: ShareExtensionError.missingSharedURL)
        })
        save.view.backgroundColor = .clear
        save.view.translatesAutoresizingMaskIntoConstraints = false
        addChild(save)
        view.addSubview(save.view)
        NSLayoutConstraint.activate([
            save.view.topAnchor.constraint(equalTo: view.topAnchor),
            save.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            save.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            save.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        save.didMove(toParent: self)
    }

    /// Shows the save, lets the inhale play, and closes the sheet.
    private func finish(_ phase: ShareSaveModel.Phase) async {
        model.phase = phase
        let hold = ShareSaveModel.inhaleDuration + (phase == .savedOffline ? 1.0 : 0.5)
        try? await Task.sleep(for: .seconds(hold))
        extensionContext?.completeRequest(returningItems: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        guard !hasStarted else { return }
        hasStarted = true

        Task { @MainActor in
            await submitSharedItem()
        }
    }

    private func submitSharedItem() async {
        do {
            let sharedURL = try await loadSharedURL()
            model.host = sharedURL.host.map { $0.hasPrefix("www.") ? String($0.dropFirst(4)) : $0 }

            // Marketing-capture mode: show the real sheet against the real
            // shared URL, but never call the API or need a session.
            if DemoCaptureFlag.isOn {
                try? await Task.sleep(nanoseconds: 800_000_000)
                if !DemoCaptureFlag.holdsSuccess {
                    // A first-run demo: queue the share for the demo Account,
                    // and close as the real sheet does.
                    if let userId = DemoCaptureFlag.userId {
                        try? pendingCaptureStore.enqueue(
                            url: sharedURL.absoluteString,
                            for: userId,
                            sourceName: Self.sourceName,
                            captureChannel: CaptureChannel.shareExtension.rawValue
                        )
                    }
                    await finish(.saved)
                    return
                }
                model.phase = .saved
                // Held far longer than the real sheet, which completes as soon
                // as the capture returns: a screenshot run needs the success
                // state on screen while it takes the picture.
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                extensionContext?.completeRequest(returningItems: nil)
                return
            }

            // A Local Library: no Account, no token. The link goes in the
            // queue the app reads when it opens; the app saves and enriches
            // it on the device.
            if LocalLibraryFlag.isOn {
                try pendingCaptureStore.enqueue(
                    url: sharedURL.absoluteString,
                    for: LocalLibraryFlag.userId,
                    sourceName: Self.sourceName,
                    captureChannel: CaptureChannel.shareExtension.rawValue
                )
                await finish(.saved)
                return
            }

            let token = try loadSharedAuthToken()
            do {
                let response = try await captureClient.capture(
                    url: sharedURL.absoluteString,
                    token: token,
                    sourceName: Self.sourceName,
                    captureChannel: CaptureChannel.shareExtension.rawValue
                )
                persistRotatedToken(from: response.http)
                await finish(.saved)
            } catch {
                guard shouldQueueCapture(after: error) else {
                    throw error
                }

                try queueCapture(sharedURL)
                await finish(.savedOffline)
            }
        } catch {
            // The sheet says what went wrong, and its Close button ends it.
            model.phase = .failed(error.localizedDescription)
        }
    }

    private func shouldQueueCapture(after error: Error) -> Bool {
        if error is URLError {
            return true
        }

        if let captureError = error as? SleevyCaptureError {
            switch captureError {
            case .invalidServerResponse, .temporarilyUnavailable:
                return true
            case .sessionExpired, .failed:
                return false
            }
        }

        if let shareError = error as? ShareExtensionError {
            switch shareError {
            case .missingSharedURL, .notSignedIn:
                return false
            }
        }

        return false
    }

    /// Mirrors a rotated `set-auth-token` back to the shared keychain so the main
    /// app and the next share see the fresh token instead of a stale snapshot.
    private func persistRotatedToken(from http: HTTPURLResponse) {
        guard
            let rotated = http.value(forHTTPHeaderField: "set-auth-token")?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            !rotated.isEmpty
        else {
            return
        }

        try? keychain.write(rotated, account: Self.authTokenAccount)
    }

    private func loadSharedAuthToken() throws -> String {
        guard
            let token = try keychain.read(account: Self.authTokenAccount),
            !token.isEmpty
        else {
            throw ShareExtensionError.notSignedIn
        }

        return token
    }

    private func loadSharedURL() async throws -> URL {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            throw ShareExtensionError.missingSharedURL
        }

        for item in extensionItems {
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    switch try await provider.loadSharedItem(forTypeIdentifier: UTType.url.identifier) {
                    case .url(let url):
                        return url
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8),
                           let url = URL(string: text) {
                            return url
                        }
                    case .text, .unsupported:
                        break
                    }
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    if case .text(let text) = try await provider.loadSharedItem(forTypeIdentifier: UTType.plainText.identifier),
                       let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
                       url.scheme?.hasPrefix("http") == true {
                        return url
                    }
                }
            }
        }

        throw ShareExtensionError.missingSharedURL
    }

    private func queueCapture(_ sharedURL: URL) throws {
        let session = try loadSharedAppSession()
        try pendingCaptureStore.enqueue(
            url: sharedURL.absoluteString,
            for: session.userId,
            sourceName: Self.sourceName,
            captureChannel: CaptureChannel.shareExtension.rawValue
        )
    }

    private func loadSharedAppSession() throws -> SleevySharedAppSession {
        guard
            let defaults = UserDefaults(suiteName: Self.appGroupIdentifier),
            let sessionData = defaults.data(forKey: Self.sharedAppSessionKey),
            let session = try? Self.decoder.decode(SleevySharedAppSession.self, from: sessionData)
        else {
            throw ShareExtensionError.notSignedIn
        }

        return session
    }

}

private enum ShareExtensionError: LocalizedError {
    case missingSharedURL
    case notSignedIn

    var errorDescription: String? {
        switch self {
        case .missingSharedURL:
            return "No shareable URL was found in this item."
        case .notSignedIn:
            return "Sign in to Sleevy in the main app before sharing links."
        }
    }
}

/// A `Sendable` projection of the non-`Sendable` `NSSecureCoding` value a shared
/// item can carry. The legacy value is coerced inside the load callback so only
/// this value type ever crosses the continuation boundary.
private nonisolated enum SharedItemValue: Sendable {
    case url(URL)
    case data(Data)
    case text(String)
    case unsupported

    init(_ item: NSSecureCoding?) {
        switch item {
        case let url as URL:
            self = .url(url)
        case let data as Data:
            self = .data(data)
        case let text as String:
            self = .text(text)
        default:
            self = .unsupported
        }
    }
}

private extension NSItemProvider {
    func loadSharedItem(forTypeIdentifier typeIdentifier: String) async throws -> SharedItemValue {
        try await withCheckedThrowingContinuation { continuation in
            loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                continuation.resume(returning: SharedItemValue(item))
            }
        }
    }
}
