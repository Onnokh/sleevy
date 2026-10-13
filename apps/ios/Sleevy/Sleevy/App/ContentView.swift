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
                } else {
                    signedOutView
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    /// The signed-out landing: the mark, the name, and the two ways in. The
    /// same monochrome as the rest of the app; nothing moves behind it.
    private var signedOutView: some View {
        VStack(spacing: 0) {
            Spacer()

            SleevyBrandmark()
                .fill(.primary)
                .frame(width: 66, height: 84)
                .padding(.bottom, 28)

            Text("Sleevy")
                .font(.system(size: 34, weight: .bold))

            Text("Save it now. Read it later.")
                .font(.body)
                .foregroundStyle(.secondary)
                .padding(.top, 6)

            Spacer()

            VStack(spacing: 12) {
                Button {
                    Task { await authStore.signInWithApple() }
                } label: {
                    if authStore.isSigningIn {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 22)
                    } else {
                        Label("Continue with Apple", systemImage: "apple.logo")
                            .frame(maxWidth: .infinity, minHeight: 22)
                    }
                }
                .buttonStyle(LandingButtonStyle(variant: .primary))
                .disabled(authStore.isSigningIn)

                Button {
                    Task { await authStore.signInWithGoogle() }
                } label: {
                    if authStore.isSigningIn {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 22)
                    } else {
                        HStack(spacing: 8) {
                            Image("GoogleLogo")
                                .resizable()
                                .scaledToFit()
                                .frame(width: 18, height: 18)
                                .accessibilityHidden(true)
                            Text("Continue with Google")
                        }
                        .frame(maxWidth: .infinity, minHeight: 22)
                    }
                }
                .buttonStyle(LandingButtonStyle(variant: .secondary))
                .disabled(authStore.isSigningIn)

                if let errorMessage = authStore.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.top, 4)
                }
            }
            .frame(maxWidth: 420)
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

/// The two sign-in buttons: a solid capsule for Apple, a grey one for
/// Google. Primary-on-background, so both read in light and dark mode.
private struct LandingButtonStyle: ButtonStyle {
    enum Variant { case primary, secondary }
    let variant: Variant

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(variant == .primary ? Color(.systemBackground) : Color.primary)
            .tint(variant == .primary ? Color(.systemBackground) : Color.primary)
            .padding(.vertical, 16)
            .background(
                variant == .primary
                    ? AnyShapeStyle(Color.primary)
                    : AnyShapeStyle(Color(.secondarySystemBackground)),
                in: Capsule()
            )
            .opacity(configuration.isPressed ? 0.75 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    ContentView()
        .environment(AuthStore())
}
