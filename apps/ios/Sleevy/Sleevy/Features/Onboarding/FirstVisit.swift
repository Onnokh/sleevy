import SwiftUI
import UIKit

/// Whether the First Visit was shown: one time, to an Account with nothing
/// saved yet.
enum FirstVisit {
    private static let key = "onboarding.first-visit-done"

    static var isDone: Bool { UserDefaults.standard.bool(forKey: key) }
    static func markDone() { UserDefaults.standard.set(true, forKey: key) }
    static func reset() { UserDefaults.standard.removeObject(forKey: key) }
}

/// The First Visit: a full-screen cover, shown one time after the first sign
/// in. Welcome, then the first save (with the real share sheet, or a link
/// from the clipboard), then Sleevy reading that save. It ends in the Library,
/// with the save as its first row.
struct FirstVisitCover: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    var store: ReadingListStore
    @State private var step = Step.welcome
    @State private var path: [Help] = []

    private enum Step: Equatable {
        case welcome
        case save
        /// The first save: its id, or nil while a share is on its way in.
        case reading(String?)
    }

    private enum Help: Hashable { case findSleevy }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                switch step {
                case .welcome:
                    FirstVisitWelcome { withAnimation(.easeOut(duration: 0.3)) { step = .save } }
                case .save:
                    FirstVisitSave(store: store) {
                        path = [.findSleevy]
                    } onShared: {
                        // The share sheet says Sleevy has the link: go on at
                        // once, as a save from Paste does. The save follows.
                        // The save may already be in: then show it.
                        guard step == .save else { return }
                        path = []
                        let first = store.snapshot(for: .completeLibrary).items.first?.id
                        withAnimation(.easeOut(duration: 0.3)) { step = .reading(first) }
                    }
                case .reading(let id):
                    FirstVisitReading(store: store, itemID: id) { finish() }
                }
            }
            .transition(.opacity)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
            .toolbar {
                if case .reading = step {} else {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Skip") { finish() }
                    }
                }
            }
            .navigationDestination(for: Help.self) { _ in
                FindSleevySteps(store: store)
                    .background(Color(.systemBackground))
            }
        }
        // The first save arrives: from the share sheet, Safari, or Paste.
        .onChange(of: store.snapshot(for: .completeLibrary).items.first?.id) { _, id in
            guard let id, step == .save || step == .reading(nil) else { return }
            path = []
            withAnimation(.easeOut(duration: 0.3)) { step = .reading(id) }
        }
        // Back from Safari: look for the save the Share Extension made.
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, step == .save else { return }
            Task { await store.refresh(.completeLibrary) }
        }
        .onDisappear { FirstVisit.markDone() }
    }

    private func finish() {
        FirstVisit.markDone()
        dismiss()
    }
}

// MARK: - Steps

/// One step of the First Visit: the content on one left edge, a third of the
/// way down, and the actions at the bottom. Every step has the same layout,
/// so only the content changes from step to step.
private struct FirstVisitPage<Content: View, Actions: View>: View {
    @ViewBuilder var content: Content
    @ViewBuilder var actions: Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            content
                .frame(maxWidth: .infinity, alignment: .leading)
            Spacer()
            Spacer()
            VStack(spacing: 8) { actions }
        }
        .padding(.horizontal, 28)
        .padding(.bottom, 12)
    }
}

private struct FirstVisitWelcome: View {
    let onStart: () -> Void

    var body: some View {
        FirstVisitPage {
            SleevyBrandmark()
                .fill(.primary)
                .aspectRatio(SleevyBrandmarkPath.aspectRatio, contentMode: .fit)
                .frame(height: 56)

            Text("Save it now.\nRead it later.")
                .font(.system(size: 44, weight: .bold))
                .tracking(-1.2)
                .lineSpacing(-4)
                .padding(.top, 28)

            Text("Sleevy keeps the links you find until you have time for them.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
        } actions: {
            PrimaryButton(title: "Get Started", action: onStart)
            // The same height as the line under the button on the next step,
            // so the button does not move.
            Color.clear.frame(height: 36)
        }
    }
}

private struct FirstVisitSave: View {
    var store: ReadingListStore
    let onFindSleevy: () -> Void
    let onShared: () -> Void
    @State private var clipboardHasLink = false
    @State private var isAddingLink = false
    @State private var isSavingPaste = false

    var body: some View {
        FirstVisitPage {
            ShareSetupStill(name: "ShareSetupRow", maxWidth: .infinity)

            Text("Save your first link")
                .font(.largeTitle.weight(.bold))
                .padding(.top, 28)
            Text("In any app, tap Share, then Sleevy. In Safari, Share is in the ••• menu.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            Button("Can’t find Sleevy?", action: onFindSleevy)
                .buttonStyle(.borderless)
                .font(.body)
                .padding(.top, 14)
        } actions: {
            ShareSetupActions(store: store, onShared: onShared)

            Group {
                if isSavingPaste {
                    ProgressView().controlSize(.small)
                } else if clipboardHasLink {
                    HStack(spacing: 8) {
                        Text("Or save the link you copied")
                            .foregroundStyle(.secondary)
                        PasteButton(payloadType: URL.self) { urls in
                            guard let url = urls.first else { return }
                            Task { @MainActor in await save(url.absoluteString) }
                        }
                        .buttonBorderShape(.capsule)
                        .labelStyle(.titleOnly)
                        .controlSize(.small)
                    }
                } else {
                    Button("Or add a link") { isAddingLink = true }
                        .buttonStyle(.borderless)
                        .foregroundStyle(.secondary)
                }
            }
            .font(.subheadline)
            .frame(height: 36)
        }
        .sheet(isPresented: $isAddingLink) {
            CaptureSheet(store: store)
        }
        .task { clipboardHasLink = await ClipboardLink.isLikely() }
        .onReceive(NotificationCenter.default.publisher(for: UIPasteboard.changedNotification)) { _ in
            Task { clipboardHasLink = await ClipboardLink.isLikely() }
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

/// The first save, large, while Sleevy reads it: the Enrichment Reveal.
private struct FirstVisitReading: View {
    var store: ReadingListStore
    let itemID: String?
    let onDone: () -> Void
    /// No save arrived in time: stop showing Sleevy reading a page it does
    /// not have yet.
    @State private var isLate = false

    var body: some View {
        // The save, or, while a share is on its way in, the first save that
        // arrives, whatever order the share sheet and the sync finish in.
        let item = itemID.flatMap(store.savedItem(id:))
            ?? store.snapshot(for: .completeLibrary).items.first
            ?? Self.onItsWay
        FirstVisitPage {
            if !isOnItsWay(item) {
                HStack(alignment: .top, spacing: 12) {
                    SavedItemFavicon(item: item, size: 26)
                        .clipShape(.rect(cornerRadius: 6, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.displayTitle)
                            .font(.callout.weight(.medium))
                            .lineLimit(2)
                        Text(item.displayDomain)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        EnrichmentRevealDetails(item: item) {
                            await store.refresh(.completeLibrary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(16)
                .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 18, style: .continuous))
                .animation(.easeOut(duration: 0.3), value: item.enrichmentStatus)
            }

            Text(title(for: item))
                .font(.largeTitle.weight(.bold))
                .contentTransition(.opacity)
                .padding(.top, 28)
            Text(isOnItsWay(item)
                 ? "It shows up in your Library as soon as it arrives."
                 : "Every save gets a summary and Tags, so you know what it is before you open it.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
        } actions: {
            PrimaryButton(title: "Go to Library", action: onDone)
            Color.clear.frame(height: 36)
        }
        .task(id: itemID == nil) {
            guard itemID == nil else { return }
            try? await Task.sleep(for: .seconds(20))
            isLate = true
        }
    }

    private func isOnItsWay(_ item: SavedItem) -> Bool {
        item.id == Self.onItsWay.id && isLate
    }

    private func title(for item: SavedItem) -> String {
        if isOnItsWay(item) { return "Saved. It is on its way." }
        return item.enrichmentStatus == .pending ? "Saved. Sleevy is reading it." : "Saved and read."
    }
}

private extension FirstVisitReading {
    /// The shared link while it is on its way in from the Share Extension:
    /// shown as a save that is being read, until the real save arrives.
    static let onItsWay: SavedItem = {
        let url = ShareSetupSheet.practiceURL
        let host = url.host ?? "sleevy.app"
        return SavedItem(
            id: "first-visit-on-its-way",
            originalURL: url.absoluteString,
            normalizedURL: url.absoluteString,
            host: host,
            title: host,
            description: nil,
            siteName: host,
            faviconURL: nil,
            faviconLightURL: nil,
            faviconDarkURL: nil,
            canonicalURL: url.absoluteString,
            previewSummary: nil,
            type: "article",
            tags: [],
            enrichmentStatus: .pending,
            sourceName: nil,
            captureChannel: nil,
            folder: nil,
            isRead: false,
            lastSavedAt: Date(),
            createdAt: Date(),
            updatedAt: Date()
        )
    }()
}

/// The main button of the First Visit: a primary-colored capsule. The accent
/// is near white in dark mode, so text in the background color reads in both
/// modes.
private struct PrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title).frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(.primary)
        .foregroundStyle(Color(.systemBackground))
        .controlSize(.large)
        .buttonBorderShape(.capsule)
    }
}
