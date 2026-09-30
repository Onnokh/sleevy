import SwiftUI

struct SettingsView: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(AppSettings.self) private var appSettings
    @State private var isShowingDeleteConfirmation = false
    @State private var isDeletingAccount = false
    @State private var deleteAccountErrorMessage: String?
    /// `nil` until the Account's value is known, so the toggle never shows a
    /// state and then flips.
    @State private var accountSettings: AccountSettings?

    let session: AppSession

    var body: some View {
        @Bindable var appSettings = appSettings
        Form {
            Section("Theme") {
                Picker("Appearance", selection: $appSettings.themePreference) {
                    ForEach(SleevyThemePreference.allCases) { theme in
                        Text(theme.title).tag(theme)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Account") {
                LabeledContent("Name", value: session.displayName)
                LabeledContent("Email", value: session.email)
                if let providerName = session.providerName {
                    LabeledContent("Provider", value: providerName)
                }

                Button(role: .destructive) {
                    Task {
                        await authStore.signOut()
                    }
                } label: {
                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }

            if let accountSettings {
                Section {
                    Toggle("Sort New Saves into Folders", isOn: Binding(
                        get: { accountSettings.autoFiling },
                        set: { isOn in Task { await setAutoFiling(isOn) } }
                    ))
                    if let api {
                        NavigationLink("Organize Unfiled Saves") {
                            OrganizeView(api: api)
                        }
                    }
                } header: {
                    Text("Organizing")
                } footer: {
                    Text("A new save goes into one of your folders when it clearly fits. This never makes new folders, and a save that fits none stays unfiled. Organize sorts the saves that are already unfiled, and may suggest new folders.")
                }
            }

            Section {
                TextField("Source name", text: $appSettings.sourceName)
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                    .onSubmit(appSettings.normalizeSourceName)

                Button("Use Device Name") {
                    appSettings.resetSourceName()
                }
                .disabled(appSettings.sourceName == SleevyUserPreferences.defaultSourceName)
            } header: {
                Text("Source Name")
            } footer: {
                Text("New links saved from this iPhone will use this name as their source.")
            }

            #if DEBUG
            Section("Developer") {
                NavigationLink(value: AppRoute.folderCardPlayground) {
                    Label("Folder Card Playground", systemImage: "paintpalette")
                }
            }
            #endif

            Section {
                Button(role: .destructive) {
                    isShowingDeleteConfirmation = true
                } label: {
                    if isDeletingAccount {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Delete Account")
                            .font(.footnote)
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(isDeletingAccount)
            } footer: {
                Text("Permanently delete your account and all saved data.")
            }
        }
        // No extra margin: the grouped Form's built-in top padding already
        // lands on `ScreenLayout.contentTopSpacing`, which Library adds
        // explicitly to its plain list.
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .onDisappear(perform: appSettings.normalizeSourceName)
        .task { await loadAccountSettings() }
        .alert("Delete Account?", isPresented: $isShowingDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete Account", role: .destructive) {
                Task {
                    isDeletingAccount = true
                    do {
                        try await authStore.deleteAccount()
                    } catch {
                        deleteAccountErrorMessage = AppConfig.userFacingNetworkMessage(for: error)
                            ?? error.localizedDescription
                    }
                    isDeletingAccount = false
                }
            }
        } message: {
            Text("This will permanently delete your account and all saved data. This cannot be undone.")
        }
        .alert("Account Deletion Failed", isPresented: Binding(
            get: { deleteAccountErrorMessage != nil },
            set: { if !$0 { deleteAccountErrorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(deleteAccountErrorMessage ?? "Please try again.")
        }
    }

    // Demo mode has no real Account behind it, so the section stays hidden.
    private var api: SleevyAPIClient? {
        DemoMode.isEnabled ? nil : .live(tokenStore: authStore.tokenStore)
    }

    private func loadAccountSettings() async {
        guard let api else { return }
        // A failed read leaves the section hidden rather than guessing a value.
        accountSettings = try? await api.loadAccountSettings()
    }

    /// Shows the change at once and puts it back if the API refuses it.
    private func setAutoFiling(_ isOn: Bool) async {
        guard let api, let previous = accountSettings else { return }
        accountSettings?.autoFiling = isOn
        do {
            accountSettings = try await api.setAutoFiling(isOn)
        } catch {
            accountSettings = previous
        }
    }
}
