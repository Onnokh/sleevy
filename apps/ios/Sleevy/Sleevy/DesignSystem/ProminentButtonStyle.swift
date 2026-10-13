import SwiftUI

/// `.borderedProminent` with a label that stays readable on the AccentColor
/// fill. The system always draws that label white, which disappears on the
/// near-white dark-mode accent. AccentForeground is the web's `--panel`, the
/// colour its docs theme puts on an `--accent` fill.
struct ProminentButtonStyle: PrimitiveButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button(role: configuration.role, action: configuration.trigger) {
            ProminentLabel(label: configuration.label)
        }
        .buttonStyle(.borderedProminent)
    }
}

extension PrimitiveButtonStyle where Self == ProminentButtonStyle {
    static var prominent: ProminentButtonStyle { ProminentButtonStyle() }
}

private struct ProminentLabel: View {
    let label: PrimitiveButtonStyleConfiguration.Label

    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        // A disabled button loses the accent fill, so it keeps the system's
        // dimmed label instead.
        if isEnabled {
            label.foregroundStyle(Color(.accentForeground))
        } else {
            label
        }
    }
}
