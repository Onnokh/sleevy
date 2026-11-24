//
//  ContentView.swift
//  Sleevy
//
//  Created by Onno Klein Hofmeijer on 01/05/2026.
//

import SwiftUI
import UIKit

struct ContentView: View {
    @Environment(AuthStore.self) private var authStore

    var body: some View {
        if let session = authStore.session, let store = authStore.readingListStore {
            SignedInTabView(session: session, tokenStore: authStore.tokenStore, store: store)
                .id(session.userId)
        } else {
            NavigationStack {
                if authStore.isRestoringSession {
                    ProgressView("Checking session...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if !authStore.hasRestoredSession {
                    // A cold start before the first session check: no
                    // session yet does not mean signed out.
                    Color.clear
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    signedOutView
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    /// The signed-out landing: the mark, the promise, and the ways in. The
    /// same glass and buttons as the Connect an Account sheet, so signing in
    /// now and connecting later look like one thing.
    private var signedOutView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 24)

            SleevyBrandmark()
                .fill(.white)
                .frame(width: 33, height: 42)
                .accessibilityLabel("Sleevy")

            SignInHeadline(text: "Save it now.\nRead it later.")
                .padding(.top, 24)

            Text("Save from any app. Sleevy reads each page and keeps it for you.")
                .font(.body)
                .foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)

            // Sleevy with no Account: the saves stay on this iPhone. An
            // Account can be connected later for sync.
            SignInButtons(progressTitle: "Signing in…", quietTitle: "Use Without an Account") {
                authStore.continueWithoutAccount()
            }
            .padding(.top, 36)
        }
        .frame(maxWidth: 420)
        .padding(.horizontal, 24)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background { SleevyGlassBackdrop() }
        // Dark while it shows, the status bar too; signed in, the app
        // follows the reader's theme again.
        .preferredColorScheme(.dark)
    }
}

#Preview {
    ContentView()
        .environment(AuthStore())
}
