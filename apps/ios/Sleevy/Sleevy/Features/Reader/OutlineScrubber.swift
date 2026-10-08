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
/// beside the content (the iPhone Duo's system rail). One mark per section
/// sits on a drum; the one level with the middle is the section being read.
///
/// The wheel turns with the finger rather than pointing at where it lands:
/// every notch of travel clicks it on by one section, with a tick under the
/// thumb, and the article follows. Past the first or last section it gives a
/// little and bumps, and on release it settles back onto the notch.
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

    /// The finger's travel from one section to the next.
    private static let notch: CGFloat = 22
    private static let fullMark: CGFloat = 22

    /// Shorter on a short screen: an item the bar cannot fit goes into its
    /// overflow menu, where a wheel is no use.
    private var height: CGFloat {
        verticalSizeClass == .compact ? 100 : 132
    }

    /// Where the wheel is, in sections, while a finger turns it: between
    /// notches mid-turn, and past the ends while it is pulled beyond them.
    @State private var turn: CGFloat?
    @State private var turnStart = 0
    @State private var pointed: Int?
    @State private var isPastEnd = false
    @State private var frame = CGRect.zero
    @State private var probe = WindowFrameProbe()
    @Environment(\.verticalSizeClass) private var verticalSizeClass

    var body: some View {
        let position = turn ?? CGFloat(activeIndex)
        let shown = pointed ?? activeIndex
        // The marks sit on a drum seen from the side: they close up and fade
        // towards the ends, and a quarter turn from the middle is out of sight.
        let radius = height / 2 - 8

        ZStack {
            ForEach(outline.indices, id: \.self) { index in
                let angle = (CGFloat(index) - position) * Self.notch / radius
                if abs(angle) < .pi / 2 {
                    let isShown = index == shown
                    Capsule()
                        .fill(isShown ? Color.accentColor : Color.secondary)
                        .frame(width: Self.fullMark * (isShown ? 1 : 0.64), height: isShown ? 3 : 2)
                        .opacity(isShown ? 1 : 0.5 * cos(angle))
                        .offset(y: radius * sin(angle))
                }
            }
        }
        .frame(width: Self.width, height: height)
        .background(WindowFrameReader(probe: probe))
        .contentShape(.rect)
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { drag in
                    if turn == nil {
                        turnStart = activeIndex
                        frame = probe.frame
                    }
                    turned(by: drag.translation.height)
                }
                .onEnded { _ in
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

    private static func give(_ overshoot: CGFloat) -> CGFloat {
        0.4 * overshoot / (1 + overshoot)
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
    /// Puts the scrubber in the vertical bar, where the device has one, and
    /// reports which side of the screen the bar is on: nil while there is no
    /// bar, before iOS 27.1, or with no outline to scrub.
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
    }
}

@available(iOS 27.1, *)
private struct VerticalBarScrubber: ViewModifier {
    let outline: ArticleOutline
    let activeIndex: Int
    let onScrub: (OutlineScrub?) -> Void
    let onEdgeChange: (HorizontalEdge?) -> Void

    @Environment(\.toolbarVerticalEdge) private var edge

    private var shownEdge: HorizontalEdge? {
        outline.isEmpty ? nil : edge
    }

    func body(content: Content) -> some View {
        content
            .toolbar {
                if shownEdge != nil {
                    ToolbarItem(placement: .bottomBar) {
                        OutlineScrubber(outline: outline, activeIndex: activeIndex, onScrub: onScrub)
                    }
                    .axisBehavior(.verticalPreferred)
                    .contentMarginsRemoved()
                }
            }
            .onChange(of: shownEdge, initial: true) { _, new in onEdgeChange(new) }
    }
}
