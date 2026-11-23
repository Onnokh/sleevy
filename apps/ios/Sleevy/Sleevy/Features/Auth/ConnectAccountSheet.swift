import SwiftUI

extension EnvironmentValues {
    /// Whether the app runs on a Local Library, with no Account: the parts
    /// that need an Account (Public Profile, publishing a Folder, Organizing)
    /// are hidden.
    @Entry var isLocalLibrary = false
}

/// Connect an Account to a Local Library: sign in, and the saves on this
/// iPhone move into the Account, with their summaries and Tags as they are.
struct ConnectAccountSheet: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(\.dismiss) private var dismiss
    var saveCount: Int

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                Text("Sync your saves")
                    .font(.largeTitle.weight(.bold))
                Text(message)
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)

                Spacer()

                VStack(spacing: 12) {
                    Button {
                        Task { await authStore.signInWithApple() }
                    } label: {
                        Label("Continue with Apple", systemImage: "apple.logo")
                            .frame(maxWidth: .infinity, minHeight: 22)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.primary)
                    .foregroundStyle(Color(.systemBackground))

                    Button {
                        Task { await authStore.signInWithGoogle() }
                    } label: {
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
                    .buttonStyle(.bordered)

                    if authStore.isSigningIn {
                        ProgressView("Moving your saves…")
                            .font(.footnote)
                            .padding(.top, 4)
                    } else if let errorMessage = authStore.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .controlSize(.large)
                .buttonBorderShape(.capsule)
                .disabled(authStore.isSigningIn)
            }
            .padding(.horizontal, 28)
            .padding(.top, 24)
            .padding(.bottom, 12)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark", role: .cancel) { dismiss() }
                        .disabled(authStore.isSigningIn)
                }
            }
        }
        .interactiveDismissDisabled(authStore.isSigningIn)
        .presentationSizing(.form)
    }

    private var message: String {
        let saves = saveCount == 1 ? "Your save moves" : "Your \(saveCount) saves move"
        let start = saveCount == 0 ? "Sign in" : "\(saves) into the Account, with their summaries and Tags."
        return "\(start) Then Sleevy keeps them the same on this iPhone, the web and your other devices."
    }
}
