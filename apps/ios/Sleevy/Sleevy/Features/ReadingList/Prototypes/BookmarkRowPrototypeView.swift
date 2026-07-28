#if DEBUG
import SwiftUI

/// PROTOTYPE — Fifteen native SwiftUI row directions on the Inbox route.
/// The question: which information hierarchy makes a Saved Item easiest to scan?
struct BookmarkRowPrototypeView: View {
    private enum Variant: String, CaseIterable, Hashable, Identifiable {
        case quiet
        case summary
        case queue
        case editorial
        case timeline
        case compact
        case aurora
        case prism
        case sheen
        case blueprint
        case plasma
        case orbit
        case refraction
        case warp
        case canvas

        var id: Self { self }

        var shortLabel: String {
            switch self {
            case .quiet: "A"
            case .summary: "B"
            case .queue: "C"
            case .editorial: "D"
            case .timeline: "E"
            case .compact: "F"
            case .aurora: "G"
            case .prism: "H"
            case .sheen: "I"
            case .blueprint: "J"
            case .plasma: "K"
            case .orbit: "L"
            case .refraction: "M"
            case .warp: "N"
            case .canvas: "O"
            }
        }

        var name: String {
            switch self {
            case .quiet: "Plain row"
            case .summary: "Summary row"
            case .queue: "Queue row"
            case .editorial: "Editorial row"
            case .timeline: "Timeline row"
            case .compact: "Sweep row"
            case .aurora: "Aurora row"
            case .prism: "Prism row"
            case .sheen: "Sheen row"
            case .blueprint: "Blueprint row"
            case .plasma: "Plasma row"
            case .orbit: "Orbit row"
            case .refraction: "Refraction row"
            case .warp: "Warp row"
            case .canvas: "Canvas row"
            }
        }

        var description: String {
            switch self {
            case .quiet: "The existing Sleevy row, tightened"
            case .summary: "A native grouped row with more context"
            case .queue: "A numbered reading queue with clear rhythm"
            case .editorial: "Title-first, like a tiny reading magazine"
            case .timeline: "A chronological thread through your saves"
            case .compact: "A dense two-line scan for a busy inbox"
            case .aurora: "A living color field for unread saves"
            case .prism: "A graphic reading signal with GPU shimmer"
            case .sheen: "A nearly-native row with a pearlescent sweep"
            case .blueprint: "A quiet technical grid with a signal pulse"
            case .plasma: "A saturated field designed to stop the scroll"
            case .orbit: "A cinematic radial pulse around the reading target"
            case .refraction: "A layer-sampled glassy refraction around the row"
            case .warp: "A spatially distorted signal that bends at the edges"
            case .canvas: "Native Canvas orbits drawn around the bookmark"
            }
        }
    }

    private struct PrototypeBookmark: Identifiable {
        let id: String
        let title: String
        let domain: String
        let time: String
        let type: String
        let tag: String?
        let summary: String
        let monogram: String
        let isUnread: Bool
        let sourceItem: SavedItem?
    }

    let sourceItems: [SavedItem]

    @State private var variant: Variant = .quiet
    @State private var selectedID: String?

    private var bookmarks: [PrototypeBookmark] {
        let mapped = sourceItems.prefix(8).map { item in
            PrototypeBookmark(
                id: item.id,
                title: item.displayTitle,
                domain: item.displayDomain,
                time: item.createdDateLabel,
                type: item.type.capitalized,
                tag: item.tags.first,
                summary: item.previewSummary ?? "A saved link ready to revisit when you have a moment.",
                monogram: item.monogram,
                isUnread: !item.isRead,
                sourceItem: item
            )
        }

        return mapped.isEmpty ? Self.fallbackBookmarks : mapped
    }

    var body: some View {
        List {
            Section {
                ForEach(Array(bookmarks.enumerated()), id: \.element.id) { index, bookmark in
                    row(for: bookmark, index: index)
                }
            } header: {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Prototype · \(variant.shortLabel) — \(variant.name)")
                        .font(.headline)
                        .textCase(nil)

                    Text(variant.description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .textCase(nil)

                    if let selectedID,
                       let selected = bookmarks.first(where: { $0.id == selectedID }) {
                        Text("Selected: \(selected.domain)")
                            .font(.caption)
                            .foregroundStyle(.tint)
                            .textCase(nil)
                    } else {
                        Text("Tap a row to preview its active state")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .textCase(nil)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .listStyle(.insetGrouped)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Picker("Saved Item row style", selection: $variant) {
                ForEach(Variant.allCases) { option in
                    Text(option.shortLabel)
                        .tag(option)
                        .accessibilityLabel(option.name)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(.bar)
        }
        .onChange(of: variant) {
            selectedID = nil
        }
    }

    @ViewBuilder
    private func row(for bookmark: PrototypeBookmark, index: Int) -> some View {
        switch variant {
        case .quiet:
            plainRow(bookmark)
        case .summary:
            summaryRow(bookmark)
        case .queue:
            queueRow(bookmark, index: index)
        case .editorial:
            editorialRow(bookmark)
        case .timeline:
            timelineRow(bookmark)
        case .compact:
            compactRow(bookmark)
        case .aurora:
            auroraRow(bookmark, index: index)
        case .prism:
            prismRow(bookmark, index: index)
        case .sheen:
            sheenRow(bookmark, index: index)
        case .blueprint:
            blueprintRow(bookmark, index: index)
        case .plasma:
            plasmaRow(bookmark, index: index)
        case .orbit:
            orbitRow(bookmark, index: index)
        case .refraction:
            refractionRow(bookmark, index: index)
        case .warp:
            warpRow(bookmark, index: index)
        case .canvas:
            canvasRow(bookmark, index: index)
        }
    }

    private func plainRow(_ bookmark: PrototypeBookmark) -> some View {
        Button {
            select(bookmark)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                favicon(for: bookmark)

                VStack(alignment: .leading, spacing: 4) {
                    Text(bookmark.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Label(bookmark.domain, systemImage: "globe")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .trailing, spacing: 6) {
                    Text(bookmark.time)
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)

                    if bookmark.isUnread {
                        Image(systemName: "circle.fill")
                            .font(.system(size: 7))
                            .foregroundStyle(.tint)
                            .accessibilityLabel("Unread")
                    }
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
        .listRowBackground(selectedBackground(for: bookmark))
    }

    private func summaryRow(_ bookmark: PrototypeBookmark) -> some View {
        Button {
            select(bookmark)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                LabeledContent {
                    Text(bookmark.time)
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                } label: {
                    Label(bookmark.domain, systemImage: "globe")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Text(bookmark.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                Text(bookmark.summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 12) {
                    Label(bookmark.type, systemImage: "doc.text")
                    if let tag = bookmark.tag {
                        Label(tag, systemImage: "tag")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
        .listRowBackground(selectedBackground(for: bookmark))
    }

    private func queueRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(spacing: 6) {
                    Text(String(format: "%02d", index + 1))
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.secondary)

                    Divider()

                    Image(systemName: bookmark.isUnread ? "circle.fill" : "checkmark.circle")
                        .font(.footnote)
                        .foregroundStyle(bookmark.isUnread ? Color.accentColor : Color.secondary)
                }
                .frame(width: 28)

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        Text(bookmark.type)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.tint)

                        Text(bookmark.time)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }

                    Text(bookmark.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Label(bookmark.domain, systemImage: "globe")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .padding(.top, 3)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
        .listRowBackground(selectedBackground(for: bookmark))
    }

    private func editorialRow(_ bookmark: PrototypeBookmark) -> some View {
        Button {
            select(bookmark)
        } label: {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        favicon(for: bookmark)
                            .frame(width: 20, height: 20)

                        Text(bookmark.domain.uppercased())
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.tint)

                        Spacer(minLength: 8)

                        Text(bookmark.time)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }

                    HStack(spacing: 7) {
                        RoundedRectangle(cornerRadius: 1)
                            .fill(bookmark.isUnread ? Color.accentColor : .clear)
                            .overlay {
                                RoundedRectangle(cornerRadius: 1)
                                    .stroke(Color.accentColor, lineWidth: bookmark.isUnread ? 0 : 1)
                            }
                            .frame(width: 6, height: 6)

                        Text(bookmark.type.uppercased())
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    Text(bookmark.title)
                        .font(.system(.title3, design: .serif).weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)

                    Text(bookmark.summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Label(bookmark.domain, systemImage: "globe")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "arrow.up.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .padding(.top, 4)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
        .listRowBackground(selectedBackground(for: bookmark))
    }

    private func timelineRow(_ bookmark: PrototypeBookmark) -> some View {
        Button {
            select(bookmark)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(spacing: 6) {
                    Image(systemName: bookmark.isUnread ? "circle.fill" : "checkmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(bookmark.isUnread ? Color.accentColor : Color.secondary)

                    Rectangle()
                        .fill(.quaternary)
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                }
                .frame(width: 18)

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text(bookmark.time)
                            .font(.caption.monospacedDigit().weight(.medium))
                            .foregroundStyle(.secondary)

                        Label(bookmark.type, systemImage: "doc.text")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Text(bookmark.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 10) {
                        favicon(for: bookmark)
                            .frame(width: 20, height: 20)

                        Text(bookmark.domain)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)

                        if let tag = bookmark.tag {
                            Text("·")
                                .foregroundStyle(.tertiary)
                            Text(tag)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
        .listRowBackground(selectedBackground(for: bookmark))
    }

    private func compactRow(_ bookmark: PrototypeBookmark) -> some View {
        Button {
            select(bookmark)
        } label: {
            HStack(spacing: 12) {
                favicon(for: bookmark)
                    .frame(width: 26, height: 26)

                VStack(alignment: .leading, spacing: 3) {
                    Text(bookmark.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        Text(bookmark.domain)
                            .lineLimit(1)

                        Text("·")
                            .foregroundStyle(.tertiary)

                        Text(bookmark.type)
                            .lineLimit(1)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .trailing, spacing: 4) {
                    Text(bookmark.time)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)

                    Image(systemName: bookmark.isUnread ? "circle.fill" : "checkmark")
                        .font(.system(size: bookmark.isUnread ? 7 : 11, weight: .semibold))
                        .foregroundStyle(bookmark.isUnread ? Color.accentColor : Color.secondary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
        .listRowBackground(selectedBackground(for: bookmark))
    }

    private func auroraRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkShaderSurface(
                    style: .aurora,
                    seed: shaderSeed(for: bookmark, index: index),
                    isSelected: selectedID == bookmark.id
                )

                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: bookmark.isUnread ? "sparkles" : "checkmark")
                                .font(.caption.weight(.bold))

                            Text(bookmark.isUnread ? "READY TO READ" : "READ")
                                .font(.caption.weight(.bold))

                            Spacer(minLength: 8)

                            Text(bookmark.time)
                                .font(.caption.monospacedDigit())
                        }

                        Text(bookmark.title)
                            .font(.headline.weight(.bold))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        HStack(spacing: 8) {
                            Label(bookmark.domain, systemImage: "globe")
                                .lineLimit(1)

                            if let tag = bookmark.tag {
                                Text("·")
                                Text(tag)
                                    .lineLimit(1)
                            }
                        }
                        .font(.caption)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)

                    favicon(for: bookmark)
                        .frame(width: 34, height: 34)
                        .background(.white.opacity(0.92), in: .circle)
                }
                .padding(14)
            }
            .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
            .clipShape(.rect(cornerRadius: 16))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func prismRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkShaderSurface(
                    style: .prism,
                    seed: shaderSeed(for: bookmark, index: index),
                    isSelected: selectedID == bookmark.id
                )

                HStack(spacing: 14) {
                    VStack(spacing: 6) {
                        Text(String(format: "%02d", index + 1))
                            .font(.title3.monospacedDigit().weight(.bold))

                        Divider()
                            .overlay(.white.opacity(0.65))

                        Image(systemName: bookmark.isUnread ? "circle.fill" : "checkmark")
                            .font(.caption.weight(.bold))
                    }
                    .frame(width: 32)
                    .foregroundStyle(.white)

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Text(bookmark.type.uppercased())
                                .font(.caption.weight(.bold))

                            Text(bookmark.time)
                                .font(.caption.monospacedDigit())
                                .opacity(0.8)
                        }

                        Text(bookmark.title)
                            .font(.body.weight(.bold))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Label(bookmark.domain, systemImage: "globe")
                            .font(.caption)
                            .lineLimit(1)
                            .opacity(0.82)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Image(systemName: "arrow.up.right")
                        .font(.body.weight(.bold))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 16)
            }
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
            .clipShape(.rect(cornerRadius: 16))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func sheenRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkPearlescentSurface(isSelected: selectedID == bookmark.id)

                HStack(spacing: 12) {
                    favicon(for: bookmark)
                        .frame(width: 30, height: 30)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(bookmark.title)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Label(bookmark.domain, systemImage: "globe")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .trailing, spacing: 5) {
                        Text(bookmark.time)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)

                        if bookmark.isUnread {
                            Image(systemName: "circle.fill")
                                .font(.system(size: 7))
                                .foregroundStyle(.tint)
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
            }
            .frame(maxWidth: .infinity, minHeight: 78, alignment: .leading)
            .clipShape(.rect(cornerRadius: 14))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func blueprintRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkShaderSurface(
                    style: .blueprint,
                    seed: shaderSeed(for: bookmark, index: index),
                    isSelected: selectedID == bookmark.id
                )

                HStack(spacing: 14) {
                    Text(String(format: "%02d", index + 1))
                        .font(.title3.monospacedDigit().weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 30)

                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 8) {
                            Text(bookmark.type.uppercased())
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.cyan)

                            Text(bookmark.time)
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.white.opacity(0.7))
                        }

                        Text(bookmark.title)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Text(bookmark.domain)
                            .font(.caption.monospaced())
                            .foregroundStyle(.white.opacity(0.68))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    SignalBars(isUnread: bookmark.isUnread)
                        .foregroundStyle(.cyan)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 14)
            }
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
            .clipShape(.rect(cornerRadius: 14))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 7, leading: 12, bottom: 7, trailing: 12))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func plasmaRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkShaderSurface(
                    style: .plasma,
                    seed: shaderSeed(for: bookmark, index: index),
                    isSelected: selectedID == bookmark.id
                )

                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "flame.fill")
                        Text(bookmark.isUnread ? "HOT SAVE" : "COOLED DOWN")
                        Spacer(minLength: 8)
                        Text(bookmark.time)
                            .font(.caption.monospacedDigit())
                    }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.9))

                    Text(bookmark.title)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 8) {
                        favicon(for: bookmark)
                            .frame(width: 20, height: 20)

                        Text(bookmark.domain)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.white.opacity(0.86))
                            .lineLimit(1)

                        Spacer(minLength: 8)

                        Image(systemName: "arrow.up.right")
                            .font(.body.weight(.bold))
                            .foregroundStyle(.white)
                    }
                }
                .padding(16)
            }
            .frame(maxWidth: .infinity, minHeight: 132, alignment: .leading)
            .clipShape(.rect(cornerRadius: 18))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func orbitRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkShaderSurface(
                    style: .orbit,
                    seed: shaderSeed(for: bookmark, index: index),
                    isSelected: selectedID == bookmark.id
                )

                HStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .stroke(.white.opacity(0.72), lineWidth: 1)
                            .frame(width: 52, height: 52)

                        favicon(for: bookmark)
                            .frame(width: 30, height: 30)
                            .background(.white.opacity(0.92), in: .circle)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Text(bookmark.type.uppercased())
                                .font(.caption.weight(.bold))

                            Text(bookmark.time)
                                .font(.caption.monospacedDigit())
                                .opacity(0.78)
                        }

                        Text(bookmark.title)
                            .font(.body.weight(.bold))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Text(bookmark.domain)
                            .font(.caption)
                            .opacity(0.78)
                            .lineLimit(1)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 15)
            }
            .frame(maxWidth: .infinity, minHeight: 108, alignment: .leading)
            .clipShape(.rect(cornerRadius: 18))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func refractionRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkShaderSurface(
                    style: .refraction,
                    seed: shaderSeed(for: bookmark, index: index),
                    isSelected: selectedID == bookmark.id
                )

                HStack(spacing: 14) {
                    favicon(for: bookmark)
                        .frame(width: 36, height: 36)
                        .background(.white.opacity(0.92), in: .circle)

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Text(bookmark.type.uppercased())
                                .font(.caption.weight(.bold))

                            Text("REFRACTED")
                                .font(.caption2.weight(.bold))
                                .opacity(0.72)

                            Spacer(minLength: 8)

                            Text(bookmark.time)
                                .font(.caption.monospacedDigit())
                                .opacity(0.78)
                        }

                        Text(bookmark.title)
                            .font(.headline.weight(.semibold))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Label(bookmark.domain, systemImage: "globe")
                            .font(.caption)
                            .opacity(0.78)
                            .lineLimit(1)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
            }
            .frame(maxWidth: .infinity, minHeight: 102, alignment: .leading)
            .clipShape(.rect(cornerRadius: 18))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func warpRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkShaderSurface(
                    style: .warp,
                    seed: shaderSeed(for: bookmark, index: index),
                    isSelected: selectedID == bookmark.id
                )

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("SIGNAL / \(String(format: "%02d", index + 1))")
                            .font(.caption.monospaced().weight(.bold))

                        Spacer(minLength: 8)

                        Image(systemName: "waveform.path.ecg")
                            .font(.body.weight(.bold))
                    }
                    .foregroundStyle(.white.opacity(0.86))

                    Text(bookmark.title)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 8) {
                        Text(bookmark.domain)
                        Text("·")
                        Text(bookmark.time)
                            .monospacedDigit()
                    }
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.74))
                }
                .padding(16)
            }
            .frame(maxWidth: .infinity, minHeight: 126, alignment: .leading)
            .clipShape(.rect(cornerRadius: 20))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func canvasRow(_ bookmark: PrototypeBookmark, index: Int) -> some View {
        Button {
            select(bookmark)
        } label: {
            ZStack {
                BookmarkCanvasSurface(
                    seed: shaderSeed(for: bookmark, index: index),
                    isSelected: selectedID == bookmark.id
                )

                HStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(.white.opacity(0.94))
                            .frame(width: 42, height: 42)

                        favicon(for: bookmark)
                            .frame(width: 30, height: 30)
                    }

                    VStack(alignment: .leading, spacing: 5) {
                        Text("IN ORBIT · \(bookmark.time)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.cyan)

                        Text(bookmark.title)
                            .font(.body.weight(.bold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Text(bookmark.domain)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.7))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 15)
            }
            .frame(maxWidth: .infinity, minHeight: 110, alignment: .leading)
            .clipShape(.rect(cornerRadius: 20))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    @ViewBuilder
    private func favicon(for bookmark: PrototypeBookmark) -> some View {
        if let sourceItem = bookmark.sourceItem {
            SavedItemFavicon(item: sourceItem)
                .frame(width: 30, height: 30)
        } else {
            Image(systemName: "link")
                .font(.body)
                .foregroundStyle(.secondary)
                .frame(width: 30, height: 30)
                .accessibilityLabel(bookmark.monogram)
        }
    }

    private func selectedBackground(for bookmark: PrototypeBookmark) -> Color {
        selectedID == bookmark.id ? Color.accentColor.opacity(0.1) : .clear
    }

    private func select(_ bookmark: PrototypeBookmark) {
        withAnimation(.snappy(duration: 0.2)) {
            selectedID = selectedID == bookmark.id ? nil : bookmark.id
        }
    }

    private func shaderSeed(for bookmark: PrototypeBookmark, index: Int) -> Float {
        let scalarTotal = bookmark.id.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return Float((scalarTotal + index * 17) % 97) / 97.0
    }

    private static let fallbackBookmarks = [
        PrototypeBookmark(id: "prototype-1", title: "Designing calm interfaces for returning to saved ideas", domain: "linear.app", time: "2h", type: "Article", tag: "Design", summary: "A practical look at reducing visual noise while keeping the next action obvious.", monogram: "L", isUnread: true, sourceItem: nil),
        PrototypeBookmark(id: "prototype-2", title: "The craft of building a tiny, excellent read-later queue", domain: "readwise.io", time: "Yesterday", type: "Website", tag: "Tools", summary: "Patterns for turning a long list of links into a gentle invitation to read.", monogram: "R", isUnread: true, sourceItem: nil),
        PrototypeBookmark(id: "prototype-3", title: "SwiftUI layout techniques worth keeping around", domain: "swiftwithmajid.com", time: "Jul 24", type: "Article", tag: "Backend", summary: "A compact collection of native layout ideas for dense but friendly screens.", monogram: "S", isUnread: false, sourceItem: nil),
        PrototypeBookmark(id: "prototype-4", title: "A visual field guide to thoughtful product details", domain: "mobbin.com", time: "Jul 22", type: "Website", tag: "Design", summary: "Small moments that help a product feel considered without becoming ornamental.", monogram: "M", isUnread: true, sourceItem: nil),
    ]
}

private struct SignalBars: View {
    let isUnread: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(1...4, id: \.self) { index in
                RoundedRectangle(cornerRadius: 1)
                    .fill(isUnread ? Color.primary : .clear)
                    .overlay {
                        if !isUnread {
                            RoundedRectangle(cornerRadius: 1)
                                .stroke(Color.primary.opacity(0.7), lineWidth: 1)
                        }
                    }
                    .frame(width: 3, height: CGFloat(5 + index * 3))
            }
        }
        .frame(width: 20, height: 18, alignment: .bottom)
        .accessibilityLabel(isUnread ? "Unread signal" : "Read signal")
    }
}

private struct BookmarkPearlescentSurface: View {
    let isSelected: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let phase = context.date.timeIntervalSinceReferenceDate / 7.0
            let angle = Angle(degrees: phase.truncatingRemainder(dividingBy: 360.0))

            RoundedRectangle(cornerRadius: 14)
                .fill(.thinMaterial)
                .overlay {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(
                            AngularGradient(
                                colors: [
                                    Color.white.opacity(0.72),
                                    Color(red: 0.86, green: 0.92, blue: 1.0).opacity(0.40),
                                    Color(red: 0.96, green: 0.83, blue: 0.94).opacity(0.34),
                                    Color(red: 0.80, green: 0.94, blue: 0.92).opacity(0.30),
                                    Color.white.opacity(0.72)
                                ],
                                center: .center,
                                angle: angle
                            )
                        )
                        .blendMode(.softLight)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(
                            isSelected ? Color.accentColor.opacity(0.55) : Color.white.opacity(0.72),
                            lineWidth: 1
                        )
                }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct BookmarkShaderSurface: View {
    enum Style {
        case aurora
        case prism
        case sheen
        case blueprint
        case plasma
        case orbit
        case refraction
        case warp
    }

    let style: Style
    let seed: Float
    let isSelected: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            GeometryReader { proxy in
                let size = SIMD2<Float>(Float(proxy.size.width), Float(proxy.size.height))
                let time = Float(context.date.timeIntervalSinceReferenceDate)
                let intensity: Float = isSelected ? 1.0 : 0.0

                renderedSurface(size: size, time: time, intensity: intensity)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func shader(size: SIMD2<Float>, time: Float, intensity: Float) -> Shader {
        switch style {
        case .aurora:
            ShaderLibrary.default.bookmarkAurora(
                .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
                .float(time),
                .float(seed),
                .float(intensity)
            )
        case .prism:
            ShaderLibrary.default.bookmarkPrism(
                .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
                .float(time),
                .float(seed),
                .float(intensity)
            )
        case .sheen:
            ShaderLibrary.default.bookmarkSheen(
                .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
                .float(time),
                .float(seed),
                .float(intensity)
            )
        case .blueprint:
            ShaderLibrary.default.bookmarkBlueprint(
                .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
                .float(time),
                .float(seed),
                .float(intensity)
            )
        case .plasma:
            ShaderLibrary.default.bookmarkPlasma(
                .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
                .float(time),
                .float(seed),
                .float(intensity)
            )
        case .orbit:
            ShaderLibrary.default.bookmarkOrbit(
                .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
                .float(time),
                .float(seed),
                .float(intensity)
            )
        case .refraction:
            BookmarkShaderSurface.refractionShader(
                size: size,
                time: time,
                seed: seed,
                intensity: intensity
            )
        case .warp:
            BookmarkShaderSurface.warpShader(
                size: size,
                time: time,
                seed: seed,
                intensity: intensity
            )
        }
    }

    @ViewBuilder
    private func renderedSurface(size: SIMD2<Float>, time: Float, intensity: Float) -> some View {
        switch style {
        case .refraction:
            Rectangle()
                .fill(.white)
                .colorEffect(baseColorShader(size: size, time: time, intensity: intensity))
                .layerEffect(
                    Self.refractionShader(size: size, time: time, seed: seed, intensity: intensity),
                    maxSampleOffset: CGSize(width: 12, height: 8)
                )
        case .warp:
            Rectangle()
                .fill(.white)
                .colorEffect(baseColorShader(size: size, time: time, intensity: intensity))
                .distortionEffect(
                    Self.warpShader(size: size, time: time, seed: seed, intensity: intensity),
                    maxSampleOffset: CGSize(width: 16, height: 8)
                )
        default:
            Rectangle()
                .fill(.white)
                .colorEffect(shader(size: size, time: time, intensity: intensity))
        }
    }

    private func baseColorShader(size: SIMD2<Float>, time: Float, intensity: Float) -> Shader {
        switch style {
        case .refraction:
            return ShaderLibrary.default.bookmarkAurora(
                .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
                .float(time),
                .float(seed),
                .float(intensity)
            )
        case .warp:
            return ShaderLibrary.default.bookmarkPrism(
                .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
                .float(time),
                .float(seed),
                .float(intensity)
            )
        default:
            return shader(size: size, time: time, intensity: intensity)
        }
    }

    static func refractionShader(size: SIMD2<Float>, time: Float, seed: Float, intensity: Float) -> Shader {
        ShaderLibrary.default.bookmarkRefraction(
            .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
            .float(time),
            .float(seed),
            .float(intensity)
        )
    }

    static func warpShader(size: SIMD2<Float>, time: Float, seed: Float, intensity: Float) -> Shader {
        ShaderLibrary.default.bookmarkWarp(
            .float2(CGPoint(x: CGFloat(size.x), y: CGFloat(size.y))),
            .float(time),
            .float(seed),
            .float(intensity)
        )
    }
}

private struct BookmarkCanvasSurface: View {
    let seed: Float
    let isSelected: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            Canvas { graphics, size in
                drawCanvas(
                    &graphics,
                    size: size,
                    time: context.date.timeIntervalSinceReferenceDate
                )
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func drawCanvas(_ graphics: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        let center = CGPoint(x: size.width * 0.72, y: size.height * 0.5)
        let baseRadius = min(size.width, size.height) * 0.22

        graphics.fill(
            Path(CGRect(origin: .zero, size: size)),
            with: .color(Color(red: 0.015, green: 0.02, blue: 0.08))
        )

        for ring in 0..<5 {
            let radius = baseRadius + CGFloat(ring) * 15
            let phase = time * (0.18 + Double(ring) * 0.025) + Double(seed) * 4
            let rect = CGRect(
                x: center.x - radius,
                y: center.y - radius * 0.66,
                width: radius * 2,
                height: radius * 1.32
            )
            let path = Path(ellipseIn: rect)
            let color: Color = ring.isMultiple(of: 2) ? .cyan : .purple
            graphics.stroke(
                path,
                with: .color(color.opacity(0.28 + abs(sin(phase)) * 0.2)),
                lineWidth: ring == 0 ? 2 : 1
            )
        }

        let dotAngle = time * 0.7 + Double(seed) * 8
        let dotRadius = baseRadius + 26
        let dot = CGPoint(
            x: center.x + CGFloat(cos(dotAngle)) * dotRadius,
            y: center.y + CGFloat(sin(dotAngle)) * dotRadius * 0.66
        )
        graphics.fill(
            Path(ellipseIn: CGRect(x: dot.x - 3, y: dot.y - 3, width: 6, height: 6)),
            with: .color(.cyan.opacity(isSelected ? 1 : 0.8))
        )
    }
}
#endif
