//
//  SleevyApp.swift
//  Sleevy
//
//  Created by Onno Klein Hofmeijer on 01/05/2026.
//

import os
import SwiftUI
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

@main
struct SleevyApp: App {
    @State private var authStore = AuthStore()
    @State private var appSettings = AppSettings()
    @State private var deepLinks = DeepLinkStore()
    private static let logger = Logger(subsystem: "app.sleevy", category: "deep-link")

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(authStore)
                .environment(appSettings)
                .environment(deepLinks)
                .preferredColorScheme(appSettings.preferredColorScheme)
                .onOpenURL { url in
                    // A widget tap arrives as a `sleevy://` URL; anything else
                    // is the Google sign-in callback.
                    Self.logger.notice("Received URL \(url.absoluteString, privacy: .public)")
                    if let link = SleevyDeepLink(url: url) {
                        deepLinks.pending = link
                        return
                    }
#if canImport(GoogleSignIn)
                    GIDSignIn.sharedInstance.handle(url)
#endif
                }
                .task {
                    DemoMode.publishSharedFlag()
                    await authStore.restoreSession()
                }
        }
    }
}
