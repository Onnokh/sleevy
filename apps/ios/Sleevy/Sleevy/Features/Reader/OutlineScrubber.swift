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

/// The Article Outline as a strip of marks the reader drags along, for the
/// vertical bar a device puts beside the content (the iPhone Duo's system
/// rail). The marks taper from the section being read, as on the outline
/// rail. A finger on the strip points at the mark level with it, the article
/// follows the finger, and lifting it leaves the reader where they stopped.
///
/// The strip only reports where the finger is; the caller scrolls and draws
/// the deck, since both are outside the bar.
struct OutlineScrubber: View {
    let outline: ArticleOutline
    let activeIndex: Int
    /// Called with every change of the pointed section while a finger is
    /// down, and with nil when it lifts. An adjustable action from VoiceOver
    /// is a scrub with a zero frame and no release.
    let onScrub: (OutlineScrub?) -> Void

    static let width: CGFloat = 44

    /// The same length whatever the outline: it takes the free part of the
    /// bar, so a short outline is still a long target for the thumb, and a
    /// long one packs its marks closer instead of pushing the bar's other
    /// items off the screen. Shorter on a short screen: an item the bar
    /// cannot fit goes into its overflow menu, where a strip is no use.
    private var height: CGFloat {
        verticalSizeClass == .compact ? 160 : 300
    }
    private static let fullMark: CGFloat = 22
    /// Room between the end marks and the ends of the bar's capsule. A finger
    /// in it still points at the end section.
    private static let endInset: CGFloat = 16

    @State private var pointed: Int?
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @State private var probe = WindowFrameProbe()

    var body: some View {
        let shown = pointed ?? activeIndex
        let pitch = (height - 2 * Self.endInset) / CGFloat(max(outline.count, 1))

        VStack(spacing: 0) {
            ForEach(outline.indices, id: \.self) { index in
                let isShown = index == shown
                Capsule()
                    .fill(isShown ? Color.accentColor : Color.secondary.opacity(0.4))
                    .frame(
                        width: Self.fullMark * OutlineRail.scale(distance: abs(index - shown)),
                        height: isShown ? 3 : 2
                    )
                    .frame(maxWidth: .infinity, minHeight: pitch, maxHeight: pitch)
            }
        }
        .animation(.easeOut(duration: 0.15), value: shown)
        .padding(.vertical, Self.endInset)
        .frame(width: Self.width, height: height)
        .background(WindowFrameReader(probe: probe))
        .contentShape(.rect)
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { drag in
                    let along = drag.location.y - Self.endInset
                    let index = min(outline.count - 1, max(0, Int(along / pitch)))
                    guard index != pointed else { return }
                    pointed = index
                    let frame = probe.frame
                    onScrub(OutlineScrub(
                        index: index,
                        markY: frame.minY + Self.endInset + (CGFloat(index) + 0.5) * pitch,
                        frame: frame
                    ))
                }
                .onEnded { _ in
                    pointed = nil
                    onScrub(nil)
                }
        )
        .sensoryFeedback(.selection, trigger: pointed) { _, new in new != nil }
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
            // A jump, not a drag: no frame, so no deck, and no release to
            // follow it.
            onScrub(OutlineScrub(index: next, markY: 0, frame: .zero))
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
