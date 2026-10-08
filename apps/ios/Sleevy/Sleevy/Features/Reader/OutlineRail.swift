import SwiftUI

/// The Article Outline as a column of marks in the article's leading gutter:
/// where the sections are, which one is being read, and a way into any of
/// them.
///
/// Mirrors `apps/web/src/components/ui/outline-rail`. The taper is what makes
/// it readable without counting — every mark the same width is a ruler, which
/// tells the reader how many sections there are and not where they are in
/// them. Tapered, the eye finds the place before it finds the marks.
///
/// The web names a section when the pointer reaches its mark. There is no
/// pointer here, so the section being read says its name and the rest stay
/// marks: the reader gets the one name a touch device can offer them without
/// asking.
struct OutlineRail: View {
    let outline: ArticleOutline
    let activeIndex: Int
    let onSelect: (OutlineEntry) -> Void

    /// How wide a mark is drawn, as a fraction of a full one, by how many
    /// sections it sits from the one being read. A table rather than a curve,
    /// so the rail is redrawn from these four numbers wherever it is rebuilt
    /// rather than from an easing function that has to be ported exactly.
    static let markScale: [CGFloat] = [1, 0.74, 0.58, 0.46]

    /// The gutter this needs before it is worth drawing. Below it the rail
    /// would be taking width from the prose it stands beside.
    static let minimumGutter: CGFloat = 108

    private static let fullMark: CGFloat = 26

    static func scale(distance: Int) -> CGFloat {
        markScale[min(distance, markScale.count - 1)]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            ForEach(Array(outline.enumerated()), id: \.element.id) { index, entry in
                mark(for: entry, at: index)
            }
        }
        // Pinned to the middle of the pane, as on web: a fixed instrument the
        // article travels past, not something that scrolls with it.
        .frame(maxHeight: .infinity, alignment: .center)
        .accessibilityLabel("Article sections")
    }

    private func mark(for entry: OutlineEntry, at index: Int) -> some View {
        let isActive = index == activeIndex
        let width = Self.fullMark * Self.scale(distance: abs(index - activeIndex))

        return Button {
            onSelect(entry)
        } label: {
            HStack(spacing: 9) {
                Capsule()
                    .fill(isActive ? Color.accentColor : Color.secondary.opacity(0.4))
                    .frame(width: width, height: 2)

                if isActive {
                    Text(entry.title)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .transition(.opacity)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            // The mark is 2pt tall, so without a floor the marks of an article
            // with one long section name bunch up around it.
            .frame(minHeight: 14, alignment: .center)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.18), value: activeIndex)
        .accessibilityLabel(entry.title)
        .accessibilityAddTraits(isActive ? [.isSelected, .isButton] : .isButton)
    }
}
