import SwiftUI

/// Where the reader's finger is on the scrubber: the section it points at,
/// and where that section's mark is on screen, so the deck can be put beside
/// it.
struct OutlineScrub: Equatable {
    let index: Int
    /// The pointed mark's centre, in window coordinates.
    let markY: CGFloat
    /// The scrubber itself, in window coordinates.
    let frame: CGRect
}

/// The Article Outline as a scroll wheel, for the vertical bar a device puts
/// beside the content (the iPhone Duo's system rail): a thumb wheel whose
/// ridges roll with the finger past a fixed line across its middle.
///
/// The wheel turns with the finger rather than pointing at where it lands:
/// every notch of travel clicks it on by one section, with a tick under the
/// thumb, and the article scrolls there. A finger held at either end of the
/// wheel keeps it turning, so a long outline needs no second stroke. Past the
/// first or last section it gives a little and bumps, and on release it
/// settles onto the notch.
///
/// The wheel only reports where it is; the caller scrolls and draws the deck,
/// since both are outside the bar.
struct OutlineScrubber: View {
    let outline: ArticleOutline
    let activeIndex: Int
    /// Called with every change of the pointed section while a finger is
    /// down, and with nil when it lifts. An adjustable action from VoiceOver
    /// is a scrub with a zero frame and no release.
    let onScrub: (OutlineScrub?) -> Void

    static let width: CGFloat = 44

    /// The finger's travel from one section to the next. The ridges roll the
    /// same distance, so they stay under the finger.
    private static let notch: CGFloat = 28

    /// Shorter on a short screen: an item the bar cannot fit goes into its
    /// overflow menu, where a wheel is no use.
    private var height: CGFloat {
        verticalSizeClass == .compact ? 120 : 200
    }

    /// Where the wheel is, in sections, while a finger turns it: between
    /// notches mid-turn, and a little past the ends while it is pulled beyond
    /// them.
    @State private var turn: CGFloat?
    @State private var turnStart = 0
    @State private var travel: CGFloat = 0
    /// Which way a finger held at an end keeps the wheel turning, or 0.
    @State private var holdDirection = 0
    @State private var holdTask: Task<Void, Never>?
    @State private var pointed: Int?
    @State private var isPastEnd = false
    @State private var frame = CGRect.zero
    @State private var probe = WindowFrameProbe()
    @Environment(\.verticalSizeClass) private var verticalSizeClass

    var body: some View {
        let shown = pointed ?? activeIndex
        let isHeld = turn != nil

        ZStack {
            WheelRidges(
                position: turn ?? CGFloat(activeIndex),
                stops: outline.count,
                spacing: Self.notch / 2,
                opacity: isHeld ? 0.5 : 0.3
            )

            Capsule()
                .fill(Color.accentColor)
                .frame(width: 24, height: 3)
        }
        .frame(width: Self.width, height: height)
        .animation(.easeOut(duration: 0.15), value: isHeld)
        .background(WindowFrameReader(probe: probe))
        .contentShape(.rect)
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { drag in
                    if turn == nil {
                        turnStart = activeIndex
                        frame = probe.frame
                    }
                    travel = drag.translation.height
                    turned(by: travel)
                    hold(direction: holdDirection(for: drag))
                }
                .onEnded { _ in
                    hold(direction: 0)
                    withAnimation(.spring(duration: 0.3, bounce: 0.2)) { turn = nil }
                    pointed = nil
                    isPastEnd = false
                    onScrub(nil)
                }
        )
        .sensoryFeedback(.selection, trigger: pointed) { _, new in new != nil }
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.8), trigger: isPastEnd) { _, new in new }
        .accessibilityElement()
        .accessibilityLabel("Article sections")
        .accessibilityValue(outline.indices.contains(shown) ? outline[shown].title : "")
        .accessibilityAdjustableAction { direction in
            let next = switch direction {
            case .increment: activeIndex + 1
            case .decrement: activeIndex - 1
            @unknown default: activeIndex
            }
            guard outline.indices.contains(next) else { return }
            // A jump, not a turn: no frame, so no deck, and no release to
            // follow it.
            onScrub(OutlineScrub(index: next, markY: 0, frame: .zero))
        }
    }

    /// Turns the wheel to where the finger has pulled it: down is further
    /// into the article, as a mouse wheel rolled towards you.
    private func turned(by travel: CGFloat) {
        let last = CGFloat(outline.count - 1)
        let free = CGFloat(turnStart) + travel / Self.notch
        // Beyond an end the wheel only gives a little, and less the further
        // it is pulled.
        let held = if free < 0 {
            -Self.give(-free)
        } else if free > last {
            last + Self.give(free - last)
        } else {
            free
        }
        turn = held
        isPastEnd = free < -0.3 || free > last + 0.3

        let index = Int(min(max(held, 0), last).rounded())
        guard index != pointed else { return }
        pointed = index
        onScrub(OutlineScrub(index: index, markY: frame.midY, frame: frame))
    }

    /// Which way the finger asks the wheel to keep turning: towards an end it
    /// is in, and has moved towards. A finger that lands on an end to turn
    /// the other way is not held there.
    private func holdDirection(for drag: DragGesture.Value) -> Int {
        let end: CGFloat = 32
        if drag.location.y < end, drag.translation.height < 0 { return -1 }
        if drag.location.y > height - end, drag.translation.height > 0 { return 1 }
        return 0
    }

    /// Turns the wheel on one section at a time for as long as the finger
    /// stays at an end, at the pace of the article's scroll to each one.
    private func hold(direction: Int) {
        guard direction != holdDirection else { return }
        holdDirection = direction
        holdTask?.cancel()
        holdTask = nil
        guard direction != 0 else { return }

        holdTask = Task {
            while true {
                try? await Task.sleep(for: .milliseconds(350))
                guard !Task.isCancelled,
                      outline.indices.contains((pointed ?? activeIndex) + direction)
                else { return }
                turnStart += direction
                withAnimation(.smooth(duration: 0.25)) { turned(by: travel) }
            }
        }
    }

    private static func give(_ overshoot: CGFloat) -> CGFloat {
        0.4 * overshoot / (1 + overshoot)
    }
}

/// The wheel's ridges, two to a section, on a drum seen from the side: they
/// close up and fade towards the ends. They stop at the first and last
/// stops, with a wider ridge one beyond each, so the reader sees how near an
/// end is. Drawn from the position as one animatable value, so a ridge never
/// jumps as the wheel settles.
private struct WheelRidges: View, Animatable {
    var position: CGFloat
    let stops: Int
    let spacing: CGFloat
    let opacity: Double

    var animatableData: CGFloat {
        get { position }
        set { position = newValue }
    }

    var body: some View {
        Canvas { context, size in
            let radius = size.height / 2 - 6
            let phase = position * 2
            let first = Int(phase.rounded(.down))
            let offset = phase - CGFloat(first)
            let reach = Int(radius * .pi / 2 / spacing) + 1
            let lastRidge = 2 * (stops - 1)

            for ridge in -reach...reach {
                // Counted from the first stop, two to a section.
                let n = first + ridge
                guard n >= -1, n <= lastRidge + 1 else { continue }
                let angle = (CGFloat(ridge) - offset) * spacing / radius
                guard abs(angle) < .pi / 2 else { continue }
                let isEnd = n == -1 || n == lastRidge + 1
                let y = size.height / 2 + radius * sin(angle)
                // Thinner as it turns away, as an edge seen at a slant.
                let thickness = (isEnd ? 3 : 2) * cos(angle)
                let width: CGFloat = isEnd ? 30 : 18
                let rect = CGRect(x: (size.width - width) / 2, y: y - thickness / 2, width: width, height: thickness)
                context.fill(
                    Path(roundedRect: rect, cornerRadius: thickness / 2),
                    with: .color(.primary.opacity((isEnd ? 1.6 : 1) * opacity * cos(angle)))
                )
            }
        }
    }
}

/// Where a view is in its window. SwiftUI's global space is the hosting
/// view's, and the vertical bar hosts its items apart from the content, so
/// the scrubber's global frame says nothing about where the content sees it.
/// Read when the finger moves, not on layout: the bar moves its items without
/// laying them out again.
@MainActor
private final class WindowFrameProbe {
    weak var view: UIView?

    var frame: CGRect {
        guard let view else { return .zero }
        return view.convert(view.bounds, to: nil)
    }
}

private struct WindowFrameReader: UIViewRepresentable {
    let probe: WindowFrameProbe

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.isUserInteractionEnabled = false
        probe.view = view
        return view
    }

    func updateUIView(_ view: UIView, context: Context) {}
}

extension View {
    /// Puts the scrubber in the vertical bar, where the device has one and
    /// there is an outline to scrub, and reports which side of the screen the
    /// bar is on: nil while there is no bar, or before iOS 27.1.
    func outlineScrubber(
        outline: ArticleOutline,
        activeIndex: Int,
        onScrub: @escaping (OutlineScrub?) -> Void,
        onEdgeChange: @escaping (HorizontalEdge?) -> Void
    ) -> some View {
        modifier(OutlineScrubberPlacement(
            outline: outline,
            activeIndex: activeIndex,
            onScrub: onScrub,
            onEdgeChange: onEdgeChange
        ))
    }
}

private struct OutlineScrubberPlacement: ViewModifier {
    let outline: ArticleOutline
    let activeIndex: Int
    let onScrub: (OutlineScrub?) -> Void
    let onEdgeChange: (HorizontalEdge?) -> Void

    func body(content: Content) -> some View {
        #if canImport(SwiftUI, _version: 8.0.85)
        if #available(iOS 27.1, *) {
            content.modifier(VerticalBarScrubber(
                outline: outline,
                activeIndex: activeIndex,
                onScrub: onScrub,
                onEdgeChange: onEdgeChange
            ))
        } else {
            content
        }
        #else
        content
        #endif
    }
}

// `toolbarVerticalEdge` is only in the iOS 27.1 SDK (SwiftUI 8.0.85). Xcode
// Cloud's "Latest Release" still builds with the iOS 27.0 SDK.
#if canImport(SwiftUI, _version: 8.0.85)
@available(iOS 27.1, *)
private struct VerticalBarScrubber: ViewModifier {
    let outline: ArticleOutline
    let activeIndex: Int
    let onScrub: (OutlineScrub?) -> Void
    let onEdgeChange: (HorizontalEdge?) -> Void

    @Environment(\.toolbarVerticalEdge) private var edge

    func body(content: Content) -> some View {
        content
            .toolbar {
                if edge != nil, !outline.isEmpty {
                    ToolbarItem(placement: .bottomBar) {
                        OutlineScrubber(outline: outline, activeIndex: activeIndex, onScrub: onScrub)
                    }
                    .axisBehavior(.verticalPreferred)
                    .contentMarginsRemoved()
                }
            }
            .onChange(of: edge, initial: true) { _, new in onEdgeChange(new) }
    }
}
#endif
