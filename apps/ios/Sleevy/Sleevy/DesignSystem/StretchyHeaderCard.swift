import SwiftUI

/// What a stretchy header card draws with on a given frame.
struct StretchyHeaderContext {
    /// The card's height right now: the base height, plus the stretch a
    /// pull-down adds.
    let height: CGFloat
    /// False once the card is fully scrolled away; animated fields use this
    /// to pause.
    let isVisible: Bool
}

extension View {
    /// The shared header-card mechanic of the Inbox, folder, and profile
    /// screens: a card painted behind the native large title that scrolls
    /// away with the content and stretches on pull-down, so the top edge
    /// never opens a seam.
    ///
    /// The card hangs from the list's first row. Put a
    /// `StretchyHeaderAnchorRow` first in the modified `List`: the card's
    /// bottom edge is drawn where that row's top edge is, in every scroll
    /// state — a pull-down, the refresh spinner, the large title collapsing,
    /// a pushed screen popping back. Nothing is inferred from the scroll
    /// offset or the content insets: on iOS 26 the space the large title
    /// takes moves between the two as the title collapses, so a card that
    /// worked its stretch out from them drifted from the rows and ended up a
    /// large-title height below the first row.
    ///
    /// The row's position changes on every scrolled pixel, so it lives in
    /// an observable box that only the header's own subview reads — a scroll
    /// frame re-renders the header alone, never the list behind it. Reading
    /// it from screen `@State` instead re-evaluated the whole list body per
    /// frame, which is what dropped frames on long lists.
    func stretchyHeaderCard(
        height: CGFloat,
        topInset: CGFloat,
        extraTopMargin: CGFloat = 0,
        @ViewBuilder header: @escaping (StretchyHeaderContext) -> some View
    ) -> some View {
        modifier(StretchyHeaderCardModifier(
            height: height,
            topInset: topInset,
            extraTopMargin: extraTopMargin,
            header: header
        ))
    }
}

/// The row a stretchy header card hangs from. It is the first row of every
/// `List` under `stretchyHeaderCard`, and draws nothing: a 0pt row whose only
/// job is to report where the rows begin, in window coordinates, on every
/// scrolled pixel.
struct StretchyHeaderAnchorRow: View {
    @Environment(\.stretchyHeaderScrollModel) private var model

    var body: some View {
        Color.clear
            .frame(height: 0)
            .listRowInsets(EdgeInsets())
            // The row background is laid out to the cell's full bounds, so
            // its top edge is the row's top edge whatever the cell adds
            // around the content.
            .listRowBackground(
                Color.clear
                    .onGeometryChange(for: CGFloat.self) { geometry in
                        geometry.frame(in: .global).minY
                    } action: { top in
                        model?.rowsTop = top
                    }
            )
            .listRowSeparator(.hidden, edges: .all)
            .accessibilityHidden(true)
    }
}

/// The per-frame readings. `@Observable` scopes the invalidation: both are
/// only read inside `StretchyHeaderBackground.body`.
@MainActor
@Observable
final class StretchyHeaderScrollModel {
    /// The top edge of the list's first row, in window coordinates. Nil
    /// until the anchor row has laid out, which draws the card at rest.
    var rowsTop: CGFloat?
    /// The card's own top edge, in window coordinates.
    var cardTop: CGFloat?
}

extension EnvironmentValues {
    @Entry var stretchyHeaderScrollModel: StretchyHeaderScrollModel?
}

private struct StretchyHeaderCardModifier<Header: View>: ViewModifier {
    let height: CGFloat
    let topInset: CGFloat
    let extraTopMargin: CGFloat
    @ViewBuilder let header: (StretchyHeaderContext) -> Header

    @State private var model = StretchyHeaderScrollModel()

    func body(content: Content) -> some View {
        content
            // The large title stays native; the card is only painted behind
            // it. The margin moves the first row just below the card's
            // bottom edge.
            .contentMargins(.top, max(0, height - topInset) + extraTopMargin, for: .scrollContent)
            .environment(\.stretchyHeaderScrollModel, model)
            // A List pads every row up to its minimum row height, the anchor
            // row included, which would put a blank band above the first
            // real row. With the minimum off, rows are as tall as their
            // content and insets; a row that leaned on the minimum states
            // its own height instead (see `ListSubtitleRow`).
            .environment(\.defaultMinListRowHeight, 0)
            .background(alignment: .top) {
                StretchyHeaderBackground(
                    baseHeight: height,
                    extraTopMargin: extraTopMargin,
                    model: model,
                    header: header
                )
            }
    }
}

private struct StretchyHeaderBackground<Header: View>: View {
    let baseHeight: CGFloat
    let extraTopMargin: CGFloat
    let model: StretchyHeaderScrollModel
    @ViewBuilder let header: (StretchyHeaderContext) -> Header

    /// How far the rows are from where they rest: positive on a pull-down,
    /// negative once the user scrolls. At rest the first row sits the extra
    /// margin below the card's base height, by construction of the content
    /// margin.
    private var shift: CGFloat {
        guard let rowsTop = model.rowsTop, let cardTop = model.cardTop else { return 0 }
        return rowsTop - cardTop - extraTopMargin - baseHeight
    }

    var body: some View {
        ZStack(alignment: .top) {
            // The card's top edge, read in the same coordinates as the anchor
            // row; the card must not assume it sits at the window's top.
            Color.clear
                .frame(height: 0)
                .onGeometryChange(for: CGFloat.self) { geometry in
                    geometry.frame(in: .global).minY
                } action: { top in
                    model.cardTop = top
                }

            header(StretchyHeaderContext(
                height: baseHeight + max(0, shift),
                isVisible: shift > -baseHeight
            ))
            .offset(y: min(0, shift))
        }
        .ignoresSafeArea(edges: .top)
    }
}
