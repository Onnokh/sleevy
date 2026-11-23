import Observation
import SwiftUI

/// What the save sheet shows, as the share goes through.
@MainActor
@Observable
final class ShareSaveModel {
    enum Phase: Equatable {
        case saving
        case saved
        /// Saved in the queue; the app sends it when the phone is online.
        case savedOffline
        case failed(String)
    }

    var phase: Phase = .saving {
        didSet {
            if savedAt == nil, phase == .saved || phase == .savedOffline { savedAt = .now }
        }
    }
    /// The shared page's host, once it is known.
    var host: String?
    let openedAt = Date.now
    private(set) var savedAt: Date?

    /// How long the inhale takes, from the save to the pill at rest.
    static let inhaleDuration: TimeInterval = 1.4
}

/// The save sheet of the Share Extension: one pill on the homepage's glass,
/// and no other words. The pill holds the shared link, and the glass's light
/// gathers under it and breathes while it saves. Saved, the pill inhales the
/// light: a band of it runs in from the screen's edges and closes on the
/// pill, and its words change to "Saved to Sleevy".
struct ShareSaveView: View {
    var model: ShareSaveModel
    var onClose: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let pill = pillRect(in: size)
            let model = model, reduceMotion = reduceMotion
            ZStack(alignment: .topLeading) {
                // The glass keeps its own 30 frames a second; it only asks
                // where the light stands at each of them.
                SleevyGlassBackdrop { date in
                    SleevyGlassLight(
                        point: CGPoint(x: pill.midX / size.width, y: pill.midY / size.height),
                        strength: Frame(model: model, now: date, reduceMotion: reduceMotion).lightStrength
                    )
                }

                // The light and the pill: 30 frames a second while the edges
                // breathe, 60 for the inhale.
                TimelineView(.animation(minimumInterval: model.savedAt == nil ? 1 / 30 : nil)) { context in
                    let frame = Frame(model: model, now: context.date, reduceMotion: reduceMotion)
                    ZStack(alignment: .topLeading) {
                        Rectangle()
                            .fill(.black.opacity(0.001))
                            .colorEffect(ShaderLibrary.sleevyInhale(
                                .float2(size),
                                .float4(pill.minX, pill.minY, pill.width, pill.height),
                                .float(pill.height / 2),
                                .float(frame.idleGlow),
                                .float(frame.inhale),
                                .float(context.date.timeIntervalSince(model.openedAt))
                            ))
                            // Soft light: one pixel per point is enough.
                            .drawingGroup()
                            .environment(\.displayScale, 1)
                            .allowsHitTesting(false)

                        PillContent(model: model, arrived: frame.arrived)
                            .frame(width: pill.width, height: pill.height)
                            .background(.white.opacity(0.08 + 0.06 * frame.flash), in: .capsule)
                            .overlay { Capsule().strokeBorder(.white.opacity(0.14 + 0.3 * frame.flash), lineWidth: 1) }
                            .scaleEffect(frame.pillScale)
                            .opacity(frame.pillOpacity)
                            .position(x: pill.midX, y: pill.midY)
                    }
                }
            }
        }
        // One space for the glass, the light and the pill: the whole screen,
        // so the light starts at its real edges.
        .ignoresSafeArea()
        .overlay(alignment: .bottom) { failure }
        .environment(\.colorScheme, .dark)
    }

    /// The pill, in the middle of the screen, where the glass is lit.
    private func pillRect(in size: CGSize) -> CGRect {
        let width = min(size.width - 72, 300)
        return CGRect(x: (size.width - width) / 2, y: size.height * 0.42 - 28, width: width, height: 56)
    }

    /// Only a failed save has more to say: why, and a way out.
    @ViewBuilder
    private var failure: some View {
        if case .failed(let reason) = model.phase {
            VStack(spacing: 20) {
                Text(reason)
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Close", action: onClose)
                    .font(.headline)
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(.white, in: .capsule)
            }
            .frame(maxWidth: 420)
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
            .transition(.opacity)
        }
    }
}

/// What the pill says: the link while it saves, then the result. The words
/// change in place.
private struct PillContent: View {
    var model: ShareSaveModel
    /// Whether the light has reached the pill: the words change then.
    var arrived: Bool

    private var shown: ShareSaveModel.Phase {
        switch model.phase {
        case .saved, .savedOffline: arrived ? model.phase : .saving
        default: model.phase
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            icon
                .frame(width: 18, height: 18)
            Text(title)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(1)
                .truncationMode(.middle)
                .contentTransition(.opacity)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .animation(.easeOut(duration: 0.3), value: shown)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
    }

    private var title: String {
        switch shown {
        case .saving: model.host ?? "Saving…"
        case .saved: "Saved to Sleevy"
        case .savedOffline: "Saved offline"
        case .failed: "Not saved"
        }
    }

    @ViewBuilder
    private var icon: some View {
        switch shown {
        case .saving:
            Image(systemName: "link")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.7))
                .transition(.opacity)
        case .saved, .savedOffline:
            BrandmarkShape()
                .fill(.white)
                .frame(width: 18 * SleevyBrandmarkPath.aspectRatio, height: 18)
                .transition(.scale(scale: 0.4).combined(with: .opacity))
        case .failed:
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.7))
                .transition(.opacity)
        }
    }
}

/// Every moving value of the save sheet at one moment.
private struct Frame {
    var pillScale = 1.0
    var pillOpacity = 1.0
    var idleGlow = 1.0
    var inhale = 0.0
    var lightStrength = 0.25
    /// The pill's own light, as the halo reaches its edge.
    var flash = 0.0
    /// The light has reached the pill.
    var arrived = false

    init(model: ShareSaveModel, now: Date, reduceMotion: Bool) {
        let open = now.timeIntervalSince(model.openedAt)
        // The pill arrives, and the light gathers under it.
        let arrive = Self.easeOut(min(open / 0.45, 1))
        pillScale = 0.94 + 0.06 * arrive
        pillOpacity = arrive
        idleGlow = arrive
        // Breathing while it saves: ±7% on a 5.5 s sine.
        lightStrength = 0.25 + 0.55 * arrive * (1 + 0.07 * sin(open * 2 * .pi / 5.5))

        if case .failed = model.phase {
            idleGlow = 0.4
            lightStrength = 0.3
            return
        }
        guard let savedAt = model.savedAt else { return }
        guard !reduceMotion else {
            arrived = true
            return
        }
        let s = now.timeIntervalSince(savedAt)

        // The inhale: the light runs in from the edges and lands on the
        // pill at `landing`. The glass light swells with it; the pill braces
        // as the light comes near, then pops on a damped spring, its edge
        // lit, and its words change.
        let landing = 0.78
        inhale = s / landing
        idleGlow = max(0, 1 - s / 0.3)
        let peak = s < landing ? Self.easeOut(s / landing) : max(0, 1 - (s - landing) / 0.7)
        lightStrength = 0.4 + 0.8 * peak
        arrived = s >= landing
        if s < landing {
            let brace = max(s - 0.5, 0) / (landing - 0.5)
            pillScale = 1 - 0.035 * brace * brace
        } else {
            let x = s - landing
            pillScale = 1 + 0.075 * exp(-7 * x) * sin(17 * x) - 0.035 * exp(-14 * x)
        }
        flash = s < landing ? 0 : max(0, 1 - (s - landing) / 0.55)
    }

    static func easeOut(_ t: Double) -> Double { 1 - pow(1 - t, 3) }
}

/// The Sleevy mark, from the path the app and its extensions share.
private struct BrandmarkShape: Shape {
    func path(in rect: CGRect) -> Path {
        Path(SleevyBrandmarkPath.path(in: rect))
    }
}
