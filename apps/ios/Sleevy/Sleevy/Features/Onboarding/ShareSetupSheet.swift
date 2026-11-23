import SwiftUI
import UIKit

/// Share Setup: the first save is the lesson. The reader opens the real share
/// sheet, taps Sleevy (iOS shows it in the row of apps), and Sleevy confirms
/// when the save arrives. Only a reader who cannot find Sleevy gets the steps
/// to add it to Favorites. The images are stills of the real share sheet,
/// made by `scripts/capture-share-setup-stills.sh`.
struct ShareSetupSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    var store: ReadingListStore
    @State private var path: [Help] = []
    @State private var contentHeight: CGFloat = 420
    @State private var detent = PresentationDetent.height(420)

    private enum Help: Hashable { case findSleevy }

    /// The page the reader shares to try it: Sleevy's own, so the first save
    /// is a real page with a real summary.
    static let practiceURL = URL(string: "https://sleevy.app")!

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if ShareSetup.isDone(in: store) {
                    done
                } else {
                    lesson
                }
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                contentHeight = height
                if path.isEmpty { detent = .height(height + 36) }
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Color(.systemBackground))
            .toolbar { closeButton }
            .navigationDestination(for: Help.self) { _ in
                FindSleevySteps(store: store)
                    .background(Color(.systemBackground))
                    .toolbar { closeButton }
            }
        }
        // As tall as the lesson. The steps to find Sleevy slide in at the same
        // height and scroll: a sheet that grows while a page slides in looks
        // wrong. The reader can drag it up.
        .presentationDetents([.height(contentHeight + 36), .large], selection: $detent)
        .presentationSizing(.form)
        // One color behind both pages: the glass of a short sheet and the
        // plain page pushed onto it otherwise differ.
        .presentationBackground(Color(.systemBackground))
        .presentationDragIndicator(.hidden)
        .animation(.easeOut(duration: 0.25), value: ShareSetup.isDone(in: store))
        // Back from Safari: look for the save the Share Extension made.
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.refresh(.completeLibrary) }
        }
    }

    private var closeButton: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Close", systemImage: "xmark", role: .cancel) { dismiss() }
        }
    }

    private var lesson: some View {
        VStack(spacing: 0) {
            ShareSetupStill(name: "ShareSetupRow")

            Text("Tap Share, then Sleevy")
                .font(.title2.weight(.bold))
                .padding(.top, 24)
            Text("The link saves, and you stay on the page.\nIn Safari, Share is in the ••• menu.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            ShareSetupActions(store: store)
                .padding(.top, 28)

            Button("Can’t find Sleevy?") { path = [.findSleevy] }
                .buttonStyle(.borderless)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.top, 14)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
        .padding(.bottom, 16)
    }

    private var done: some View {
        VStack(spacing: 0) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.green)
            Text("Sleevy is in your share sheet")
                .font(.title2.weight(.bold))
                .padding(.top, 16)
            Text("Your first save is in the Library. From now on, tap Share, then Sleevy, in any app.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            Button { dismiss() } label: {
                Text("Done").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.primary)
            .foregroundStyle(Color(.systemBackground))
            .controlSize(.large)
            .buttonBorderShape(.capsule)
            .padding(.top, 28)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
        .padding(.top, 8)
        .padding(.bottom, 16)
    }
}

/// The main action of Share Setup: open the real share sheet, with the real
/// page, and confirm when the reader shares it with Sleevy.
struct ShareSetupActions: View {
    var store: ReadingListStore
    var showsSafari = false
    /// Called when the reader shared the link with Sleevy.
    var onShared: (() -> Void)? = nil
    @Environment(\.openURL) private var openURL
    @State private var usedOtherSleevy = false

    /// This app's name in the share sheet: "Sleevy", or "Sleevy Dev".
    private var appName: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "Sleevy"
    }

    var body: some View {
        VStack(spacing: 12) {
            Button {
                SystemShareSheet.present(url: ShareSetupSheet.practiceURL) { outcome in
                    usedOtherSleevy = outcome == .otherSleevy
                    guard outcome == .sleevy else { return }
                    ShareSetup.markDone()
                    onShared?()
                    Task { await store.refresh(.completeLibrary) }
                }
            } label: {
                Label("Try It Now", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity)
            }
            // The accent is near white in dark mode: a primary-colored button
            // with background-colored text reads in both modes.
            .buttonStyle(.borderedProminent)
            .tint(.primary)
            .foregroundStyle(Color(.systemBackground))

            if usedOtherSleevy {
                Text("You used another Sleevy app. Tap \(appName) in the share sheet.")
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if showsSafari {
                Button("Or try it in Safari") { openURL(ShareSetupSheet.practiceURL) }
                    .buttonStyle(.borderless)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .controlSize(.large)
        .buttonBorderShape(.capsule)
    }
}

/// For a reader who does not see Sleevy in the row: add it to Favorites,
/// so it is always first. One step for each part of the share sheet.
struct FindSleevySteps: View {
    var store: ReadingListStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Text("Put Sleevy first in the share sheet. You do this one time.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                step(1, "Swipe the row of apps to the end, and tap More.", still: "ShareSetupMore")
                step(2, "Tap Edit.", still: "ShareSetupEdit")
                step(3, "Tap the plus next to Sleevy.", still: "ShareSetupPlus")
                step(4, "Tap Done. Sleevy is now first in the row.", still: "ShareSetupFirst")

                ShareSetupActions(store: store, showsSafari: true)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
        }
        .navigationTitle("Add Sleevy to Favorites")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func step(_ number: Int, _ text: String, still: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("\(number)")
                    .font(.callout.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                Text(text)
                    .font(.callout)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ShareSetupStill(name: still)
        }
    }
}

/// A still of the real share sheet, cropped to one part of it.
struct ShareSetupStill: View {
    let name: String
    var maxWidth: CGFloat = 360

    var body: some View {
        Image(name)
            .resizable()
            .scaledToFit()
            .frame(maxWidth: maxWidth)
            .clipShape(.rect(cornerRadius: 18, style: .continuous))
            .accessibilityHidden(true)
    }
}

/// Whether the reader has saved with the Share Extension at least once:
/// then Sleevy is in their share sheet, and the setup is done.
enum ShareSetup {
    private static let key = "onboarding.share-setup-done"

    static func reset() {
        UserDefaults.standard.removeObject(forKey: key)
    }

    static func markDone() {
        UserDefaults.standard.set(true, forKey: key)
    }

    @MainActor
    static func isDone(in store: ReadingListStore) -> Bool {
        if UserDefaults.standard.bool(forKey: key) { return true }
        let saved = store.snapshot(for: .completeLibrary).items.contains {
            $0.captureChannel == CaptureChannel.shareExtension.rawValue
        }
        if saved { markDone() }
        return saved
    }
}

/// The real iOS share sheet, shown over whatever is on screen.
@MainActor
enum SystemShareSheet {
    enum Outcome {
        /// Shared with this app's own Share Extension.
        case sleevy
        /// Shared with another Sleevy app on this iPhone: the App Store app
        /// next to the Dev Variant, which saves into its own Account.
        case otherSleevy
        /// Shared elsewhere, or not at all.
        case other
    }

    static func present(url: URL, completion: @escaping (Outcome) -> Void) {
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.completionWithItemsHandler = { activityType, completed, _, _ in
            let own = (Bundle.main.bundleIdentifier ?? "") + ".ShareExtension"
            let type = activityType?.rawValue ?? ""
            if completed && type == own {
                completion(.sleevy)
            } else if completed && type.hasPrefix("app.sleevy") && type.hasSuffix(".ShareExtension") {
                completion(.otherSleevy)
            } else {
                completion(.other)
            }
        }
        guard let top = topViewController() else { return }
        controller.popoverPresentationController?.sourceView = top.view
        controller.popoverPresentationController?.sourceRect = CGRect(
            x: top.view.bounds.midX, y: top.view.bounds.maxY - 80, width: 0, height: 0
        )
        top.present(controller, animated: true)
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
