import SwiftUI

extension EnvironmentValues {
    /// Whether the app runs on a Local Library, with no Account: the parts
    /// that need an Account (Public Profile, publishing a Folder, Organize)
    /// are hidden.
    @Entry var isLocalLibrary = false
}

/// Connect an Account to a Local Library: sign in, and the saves on this
/// iPhone move into the Account, with their summaries and Tags as they are.
///
/// It sells sync, the one thing a Local Library cannot do: summaries, Tags
/// and Auto-Filing already happen on the device. It speaks the language of
/// the web app's iPhone hand-off, the same invitation the other way round:
/// the homepage's glass, a short headline, the places, a white button.
/// Always dark, like that glass.
struct ConnectAccountSheet: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(\.dismiss) private var dismiss
    var saveCount: Int

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 24)

                SignInEyebrow(text: "Sleevy Account")
                SignInHeadline(text: "Save it on your iPhone.\nRead it anywhere.")
                    .padding(.top, 10)

                HStack(spacing: 10) {
                    PlaceMark(image: "SleevyAppIcon", inset: 10, corner: 6)
                    PlaceMark(image: "ChromeLogo", inset: 10)
                    PlaceMark(image: "RaycastLogo", inset: 11)
                }
                .padding(.top, 26)
                .accessibilityHidden(true)

                Text(message)
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 16)

                SignInButtons(progressTitle: "Moving your saves…", quietTitle: "Not Now") { dismiss() }
                    .padding(.top, 36)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 8)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark", role: .cancel) { dismiss() }
                        .disabled(authStore.isSigningIn)
                }
            }
        }
        .environment(\.colorScheme, .dark)
        .presentationBackground { SleevyGlassBackdrop() }
        .interactiveDismissDisabled(authStore.isSigningIn)
        .presentationSizing(.form)
    }

    private var message: String {
        let saves = switch saveCount {
        case 0: ""
        case 1: " Your save comes with you,"
        default: " Your \(saveCount) saves come with you,"
        }
        let safe = saveCount == 0 ? " If you lose this iPhone, your saves are still there." : " and stay safe if you lose this iPhone."
        return "The web, Chrome and Raycast." + saves + safe
    }
}

/// One place an Account syncs to, as its own mark on a small piece of glass.
private struct PlaceMark: View {
    var image: String
    var inset: CGFloat
    var corner: CGFloat = 0

    var body: some View {
        Image(image)
            .resizable()
            .scaledToFit()
            .clipShape(.rect(cornerRadius: corner, style: .continuous))
            .padding(inset)
            .frame(width: 44, height: 44)
            .background(.white.opacity(0.06), in: .rect(cornerRadius: 11, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .strokeBorder(.white.opacity(0.1), lineWidth: 1)
            }
    }
}
