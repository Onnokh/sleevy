import SwiftUI

/// The section under the reader's finger as a card, with the sections either
/// side half-hidden behind it: where they are, and which way the one they want
/// lies.
///
/// A port of the deck in `apps/web/src/components/ui/outline-rail`, with the
/// same sizes. One deck for the whole outline, and one card per section keyed
/// by the section, so moving along the outline changes what each card *is*
/// rather than what it says: the one below grows into the place in front and
/// opens to show its first lines, while the one in front shrinks back into the
/// place above.
///
/// The deck is centred on its own origin, so the caller puts that on the mark
/// it belongs to.
struct OutlineDeck: View {
    let outline: ArticleOutline
    /// The section in front.
    let frontIndex: Int

    static let width: CGFloat = 272

    /// How the cards move between places, and how the deck travels to the
    /// next mark: the web deck's curve.
    static let travel = Animation.timingCurve(0.22, 0.61, 0.36, 1, duration: 0.22)

    /// How many sections either side of the front one the deck keeps. Only the
    /// next ones are drawn; the pair beyond wait out of sight, so a card coming
    /// into the deck has a place to come from.
    private static let reach = 2

    /// A card behind: its name and the room to print it.
    private static let peekHeight: CGFloat = 44
    /// What the card in front covers of one behind.
    private static let peekOverlap: CGFloat = 8
    /// The card in front: the same, opened to show two lines of the section.
    private static let cardHeight: CGFloat = 84
    /// How far short of the card in front the cards behind stop, on the
    /// trailing side only. Flush on the leading side, so the names line up.
    private static let peekShortfall: CGFloat = 14
    private static let inset: CGFloat = 14
    /// The width every card sets its words at, front or behind, so a name is
    /// wrapped once and never moves while its card does.
    private static let textWidth = width - peekShortfall - 2 * inset

    var body: some View {
        let front = outline[frontIndex]
        // A section with nothing under its heading has nothing to open for, so
        // its card in front is the height of the ones behind.
        let frontHeight = front.excerpt.isEmpty ? Self.peekHeight : Self.cardHeight

        ZStack(alignment: .topLeading) {
            ForEach(Array(outline.enumerated()), id: \.element.id) { index, entry in
                let distance = index - frontIndex
                if abs(distance) <= Self.reach {
                    card(entry, distance: distance, frontHeight: frontHeight)
                }
            }
        }
        .frame(width: Self.width, height: 0, alignment: .topLeading)
        .animation(Self.travel, value: frontIndex)
        .accessibilityHidden(true)
    }

    private func card(_ entry: OutlineEntry, distance: Int, frontHeight: CGFloat) -> some View {
        let isFront = distance == 0
        let depth = abs(distance)
        let height = isFront ? frontHeight : Self.peekHeight
        let step = Self.peekHeight - Self.peekOverlap

        let top: CGFloat = if isFront {
            -frontHeight / 2
        } else if distance < 0 {
            -frontHeight / 2 - Self.peekHeight + Self.peekOverlap - CGFloat(depth - 1) * step
        } else {
            frontHeight / 2 - Self.peekOverlap + CGFloat(depth - 1) * step
        }

        return VStack(alignment: .leading, spacing: 5) {
            Text(entry.title)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(isFront ? .primary : .secondary)
                .lineLimit(1)

            Text(entry.excerpt)
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .lineSpacing(2)
                .opacity(isFront ? 1 : 0)
        }
        .frame(width: Self.textWidth, alignment: .leading)
        // Kept at its own height inside a card that is shorter: the card hides
        // what does not fit, and the words are never squeezed.
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, Self.inset)
        .padding(.top, 12)
        .frame(
            width: Self.width - (isFront ? 0 : Self.peekShortfall),
            height: height,
            alignment: .topLeading
        )
        .background(isFront ? Color(.systemGray5) : Color(.secondarySystemBackground))
        .clipShape(.rect(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color(.separator), lineWidth: 0.5)
        }
        // The tight shadow draws the edge against the cards behind, the wide
        // one lifts the deck off the article.
        .shadow(color: .black.opacity(isFront ? 0.12 : 0), radius: 1, y: 1)
        .shadow(color: .black.opacity(isFront ? 0.18 : 0), radius: 14, y: 10)
        // Beyond the drawn cards, waiting its turn.
        .opacity(depth > 1 ? 0 : 1)
        .zIndex(Double(3 - depth))
        .offset(y: top)
    }
}
