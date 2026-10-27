import SwiftUI

/// The whole Article Outline at once, from a tap on the scroll wheel: the
/// article's title, then every section, numbered. The section being read is
/// marked, and the ones before it are dimmed as read.
///
/// It lists the wheel's stops, so a row is a place the wheel can turn to.
struct OutlineOverview: View {
    /// The article's title, then its sections.
    let stops: ArticleOutline
    let activeStop: Int
    let onSelect: (Int) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("Outline")
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(stops.count == 2 ? "1 section" : "\(stops.count - 1) sections")
                            .foregroundStyle(.tertiary)
                    }
                    .font(.system(size: 15))
                    .padding(.horizontal, 20)
                    .padding(.bottom, 6)

                    ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                        row(stop, at: index)
                            .id(index)
                    }
                }
                .padding(.vertical, 18)
            }
            .scrollIndicators(.hidden)
            .onAppear { proxy.scrollTo(activeStop, anchor: .center) }
        }
        .frame(width: 340)
        .frame(maxHeight: 520)
    }

    private func row(_ stop: OutlineEntry, at index: Int) -> some View {
        let isActive = index == activeStop
        let isRead = index < activeStop
        let isTitle = index == 0

        return Button {
            onSelect(index)
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(isTitle ? "" : "\(index)")
                    .font(.system(size: 15))
                    .monospacedDigit()
                    .foregroundStyle(.tertiary)
                    .frame(minWidth: 18, alignment: .leading)

                Text(stop.title)
                    .font(.system(size: 17, weight: isTitle || isActive ? .semibold : .regular))
                    .foregroundStyle(
                        isActive ? AnyShapeStyle(.primary)
                            : isRead ? AnyShapeStyle(.tertiary)
                            : AnyShapeStyle(.secondary)
                    )
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 20)
            .overlay(alignment: .leading) {
                if isActive {
                    Capsule()
                        .fill(.primary)
                        .frame(width: 3)
                        .padding(.vertical, 11)
                        .padding(.leading, 8)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isTitle ? "Top of the article: \(stop.title)" : stop.title)
        .accessibilityAddTraits(isActive ? [.isSelected, .isButton] : .isButton)
    }
}
