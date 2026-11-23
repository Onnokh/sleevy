import SwiftUI

/// The parts every sign-in screen shares: the sign-in landing and the
/// Connect an Account sheet. They speak the language of the web app's iPhone
/// hand-off: the homepage's glass, a short headline, a white button and a
/// dark glass one. Always dark, like that glass.

/// The homepage's glass, live (SignInGlass.metal): satin ribbons in the
/// dark under slow, wandering lights, dark under the words. Reduce Motion
/// gets its first frame as a still.
struct SignInGlassBackdrop: View {
    private static let ground = Color(red: 8 / 255, green: 9 / 255, blue: 12 / 255)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date.now

    var body: some View {
        ZStack {
            Self.ground
            if reduceMotion {
                Image("SyncGlass")
                    .resizable()
                    .scaledToFill()
                    .frame(maxHeight: .infinity, alignment: .top)
            } else {
                // A slow field: 30 frames a second is enough, and saves the
                // battery.
                TimelineView(.animation(minimumInterval: 1 / 30)) { context in
                    let seconds = context.date.timeIntervalSince(start)
                    GeometryReader { proxy in
                        Rectangle()
                            .colorEffect(ShaderLibrary.signInGlass(
                                .float2(proxy.size),
                                .float(seconds),
                                .float2(Self.roam(seconds)),
                                .float(0.25)
                            ))
                    }
                }
            }
            LinearGradient(
                stops: [
                    .init(color: Self.ground.opacity(0.1), location: 0),
                    .init(color: Self.ground.opacity(0.45), location: 0.38),
                    .init(color: Self.ground.opacity(0.92), location: 0.62),
                    .init(color: Self.ground, location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    /// The web's roaming light, with no pointer: a slow loop over the glass.
    private static func roam(_ seconds: Double) -> CGPoint {
        CGPoint(x: 0.5 + 0.2 * sin(seconds * 0.21), y: 0.46 + 0.2 * sin(seconds * 0.33 + 1.1))
    }
}

/// The small grey line over a sign-in headline.
struct SignInEyebrow: View {
    var text: String

    var body: some View {
        Text(text)
            .font(.footnote.weight(.medium))
            .foregroundStyle(.white.opacity(0.62))
    }
}

/// A sign-in headline: two short sentences, one per line.
struct SignInHeadline: View {
    var text: String

    var body: some View {
        Text(text)
            .font(.system(size: 34, weight: .semibold))
            .tracking(-1.2)
            .foregroundStyle(.white)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Continue with Apple, Continue with Google, and one quiet action under
/// them (Not Now, or Use Without an Account). While a sign-in runs, the
/// quiet action makes room for its progress; a failed one shows its error.
struct SignInButtons: View {
    @Environment(AuthStore.self) private var authStore
    var progressTitle: String
    var quietTitle: String
    var quietAction: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Button {
                Task { await authStore.signInWithApple() }
            } label: {
                Label("Continue with Apple", systemImage: "apple.logo")
            }
            .buttonStyle(SignInButtonStyle(isPrimary: true))

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
            }
            .buttonStyle(SignInButtonStyle(isPrimary: false))

            Group {
                if authStore.isSigningIn {
                    ProgressView(progressTitle)
                } else {
                    Button(quietTitle, action: quietAction)
                        .foregroundStyle(.white.opacity(0.62))
                }
            }
            .font(.subheadline.weight(.medium))
            .frame(minHeight: 36)

            if !authStore.isSigningIn, let errorMessage = authStore.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .disabled(authStore.isSigningIn)
    }
}

/// The hero's two buttons, as on the web: one white, one dark glass.
private struct SignInButtonStyle: ButtonStyle {
    var isPrimary: Bool
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(isPrimary ? .black : .white)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(isPrimary ? AnyShapeStyle(.white) : AnyShapeStyle(.white.opacity(0.08)), in: .capsule)
            .overlay {
                if !isPrimary {
                    Capsule().strokeBorder(.white.opacity(0.12), lineWidth: 1)
                }
            }
            .contentShape(.capsule)
            .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.5)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
