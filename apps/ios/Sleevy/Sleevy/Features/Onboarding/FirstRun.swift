import SwiftUI
import UIKit

// MARK: - First-Run Library

/// The rows a new Account sees in the Library while it has no Saved Items:
/// add the first link, and set up saving from any app. Rows in the list's
/// own rhythm, under a heading, never a welcome screen.
struct FirstRunRows: View {
    var store: ReadingListStore
    @State private var isAddingLink = false
    @State private var isSettingUpShare = false
    @State private var clipboardHasLink = false
    @State private var isSavingPaste = false

    var body: some View {
        Section {
            ListGroupHeading(title: "Start here")

            if clipboardHasLink {
                StartRow(
                    systemImage: "link",
                    title: "Save the link you copied",
                    subtitle: "One tap, nothing to type"
                ) {
                    if isSavingPaste {
                        ProgressView().controlSize(.small)
                    } else {
                        PasteButton(payloadType: URL.self) { urls in
                            guard let url = urls.first else { return }
                            Task { @MainActor in await save(url.absoluteString) }
                        }
                        .buttonBorderShape(.capsule)
                        .labelStyle(.titleAndIcon)
                        .controlSize(.small)
                    }
                }
            } else {
                Button {
                    isAddingLink = true
                } label: {
                    StartRow(systemImage: "plus", title: "Add a link", subtitle: "Paste or type a URL") {
                        EmptyView()
                    }
                }
                .buttonStyle(.plain)
                .sheet(isPresented: $isAddingLink) {
                    CaptureSheet(store: store)
                }
            }

            StartRow(
                systemImage: "square.and.arrow.up",
                title: "Save from any app",
                subtitle: "In Safari or X, tap Share, then Sleevy"
            ) {
                Button("Set Up") { isSettingUpShare = true }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
            }
            // Each sheet on one row: on a Section, List puts it on every row.
            .sheet(isPresented: $isSettingUpShare) {
                ShareSetupSheet(store: store)
            }
            .task {
                clipboardHasLink = await ClipboardLink.isLikely()
            }
            .onReceive(NotificationCenter.default.publisher(for: UIPasteboard.changedNotification)) { _ in
                Task { clipboardHasLink = await ClipboardLink.isLikely() }
            }
        }
    }

    private func save(_ url: String) async {
        isSavingPaste = true
        defer { isSavingPaste = false }
        do {
            _ = try await store.capture(url)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        }
    }
}

/// A row of the first run: a symbol where a save has its favicon, a title and
/// a grey line, and an action at the end.
private struct StartRow<Trailing: View>: View {
    let systemImage: String
    let title: String
    let subtitle: String
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .regular))
                .frame(width: 26, height: 26)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.callout.weight(.medium))
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            trailing()
        }
        .contentShape(Rectangle())
        .padding(.vertical, ListRhythm.rowPadding)
        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }
}

enum ClipboardLink {
    /// Whether the clipboard looks like a link. iOS answers this without the
    /// paste prompt; only the system Paste button reads the link itself.
    static func isLikely() async -> Bool {
        let patterns = try? await UIPasteboard.general.detectedPatterns(for: [\.probableWebURL])
        return patterns?.contains(\.probableWebURL) ?? false
    }
}

// MARK: - First-Run Inbox

/// Recents for an Account that never saved anything: not All Caught Up,
/// which would say there was something to catch up on.
struct FirstRunRecents: View {
    var store: ReadingListStore
    let height: CGFloat
    @State private var isAddingLink = false

    var body: some View {
        ContentUnavailableView {
            Label("Nothing to read yet", systemImage: "clock")
        } description: {
            Text("What you save shows up here, newest first, until you read it.")
        } actions: {
            Button("Add a link", systemImage: "plus") { isAddingLink = true }
                .buttonStyle(.bordered)
                .buttonBorderShape(.capsule)
        }
        .frame(maxWidth: .infinity, minHeight: height)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .sheet(isPresented: $isAddingLink) {
            CaptureSheet(store: store)
        }
    }
}

// MARK: - Share Setup row

/// After the first save, until Share Setup is done: the same row as in the
/// first run, so the way to save from any app stays one tap away. A swipe
/// hides it.
struct ShareSetupRow: View {
    var store: ReadingListStore
    @AppStorage("onboarding.share-row-hidden") private var isHidden = false
    @State private var isSettingUpShare = false

    var body: some View {
        if !isHidden {
            StartRow(
                systemImage: "square.and.arrow.up",
                title: "Save from any app",
                subtitle: "In Safari or X, tap Share, then Sleevy"
            ) {
                Button("Set Up") { isSettingUpShare = true }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
            }
            .swipeActions(edge: .trailing) {
                Button("Hide", systemImage: "eye.slash") { isHidden = true }
            }
            .sheet(isPresented: $isSettingUpShare) {
                ShareSetupSheet(store: store)
            }
        }
    }
}

// MARK: - Enrichment Reveal

/// Under the first save's row while it is enriched: Sleevy reading the page,
/// then its Preview Summary and Tags. Refreshes until the enrichment arrives.
struct EnrichmentRevealDetails: View {
    let item: SavedItem
    let refresh: () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            switch item.enrichmentStatus {
            case .pending:
                VStack(alignment: .leading, spacing: 7) {
                    skeleton(1)
                    skeleton(0.9)
                    skeleton(0.62)
                }
                .padding(.top, 6)
                HStack(spacing: 7) {
                    ProgressView().controlSize(.mini)
                    Text("Reading the page…")
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(.top, 4)
            case .enriched, .failed:
                if let summary = item.previewSummary {
                    Text(summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 6)
                        .transition(.opacity)
                }
                if !item.tags.isEmpty {
                    Text(item.tags.map { "# \(tagDisplayName($0))" }.joined(separator: "   "))
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                        .transition(.opacity)
                }
                if item.previewSummary != nil || !item.tags.isEmpty {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark")
                            .font(.caption2.weight(.semibold))
                        Text("Summarized and tagged for you")
                    }
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.top, 2)
                        .transition(.opacity)
                }
            }
        }
        .animation(.easeOut(duration: 0.4), value: item.enrichmentStatus)
        .task(id: item.enrichmentStatus) {
            guard item.enrichmentStatus == .pending else { return }
            for _ in 0..<20 {
                try? await Task.sleep(for: .seconds(1.5))
                guard !Task.isCancelled else { return }
                await refresh()
            }
        }
    }

    private func skeleton(_ width: CGFloat) -> some View {
        GeometryReader { proxy in
            Capsule()
                .fill(Color.secondary.opacity(0.18))
                .frame(width: proxy.size.width * width)
        }
        .frame(height: 8)
    }
}
