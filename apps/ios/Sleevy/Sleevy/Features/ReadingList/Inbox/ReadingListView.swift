import SwiftUI
import UIKit

struct ReadingListView: View {
    @Environment(\.openSavedItem) private var openSavedItem
    var store: ReadingListStore
    @State private var isCaptureCapsuleOpen = false
    @State private var captureDraft = ""
    @State private var shouldFocusCaptureDraft = false
    @State private var isSavingCapture = false
    @State private var captureErrorMessage: String?
    @State private var isReadingListScrolled = false
    @State private var capturePlacement: CapturePlacement = .inlineRow
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let snapshot = store.snapshot(for: .inbox)

        GeometryReader { geometry in
            readingList(snapshot: snapshot, emptyStateHeight: geometry.size.height * 0.7)
        }
        .listStyle(.plain)
        .groupedSavesList()
        .scrollContentBackground(.hidden)
        .background(Color(.systemBackground))
        .refreshable {
            await store.refresh()
        }
        .navigationTitle("Recents")
        .navigationBarTitleDisplayMode(.large)
        .modifier(NavigationSubtitleIfAvailable(subtitle: navigationSubtitleText(unreadCount: snapshot.items.count)))
        .toolbarPreferringVerticalBar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    toggleCaptureCapsule()
                } label: {
                    Image(systemName: isCaptureCapsuleOpen ? "xmark" : "plus")
                        .contentTransition(.symbolEffect(.replace))
                }
                .disabled(isSavingCapture)
                .accessibilityLabel(isCaptureCapsuleOpen ? "Close Capture" : "Add Link")
            }
        }
        .task {
            await store.loadIfNeeded()
        }
    }

    private func readingList(snapshot: RetrievalSnapshot, emptyStateHeight: CGFloat) -> some View {
        List {
            if store.isLoading,
               snapshot.coverage == .loading,
               snapshot.items.isEmpty,
               store.pendingSavedItems.isEmpty {
                ReadingListLoadingRow(height: emptyStateHeight)
            } else if snapshot.coverage.hasLoaded,
                      snapshot.items.isEmpty,
                      store.pendingSavedItems.isEmpty,
                      !isCaptureCapsuleOpen {
                // Not before the first load: All Caught Up would flash at
                // launch, before the saves arrive.
                EmptyReadingListRow(height: emptyStateHeight)
            }

            if isCaptureCapsuleOpen && capturePlacement == .inlineRow {
                Section {
                    captureCapsule
                        .listRowInsets(EdgeInsets(top: 10, leading: 18, bottom: 8, trailing: 18))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }

            if !store.pendingSavedItems.isEmpty {
                Section {
                    ForEach(store.pendingSavedItems) { item in
                        PendingSavedItemRow(item: item) {
                            store.removePendingSavedItem(item)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                store.removePendingSavedItem(item)
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                        }
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                }
            }

            if let errorMessage = store.errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            // Grouped by the day the save arrived. Each day's heading stays at
            // the top while its saves scroll, until the next day pushes it out.
            let days = InboxDay.groups(snapshot.items)
            ForEach(days) { group in
                Section {
                    ForEach(group.items) { item in
                        SavedItemRow(item: item) {
                            await markOpened(item)
                        } onToggleRead: {
                            await setRead(item, isRead: !item.isRead)
                        } onDelete: {
                            await store.delete(item)
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button {
                                Task {
                                    await setRead(item, isRead: !item.isRead)
                                }
                            } label: {
                                Label(
                                    item.isRead ? "Unread" : "Read",
                                    systemImage: item.isRead ? "circle" : "checkmark.circle"
                                )
                            }
                            .tint(item.isRead ? .orange : .green)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task {
                                    await store.delete(item)
                                }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                } header: {
                    ListGroupHeading(title: group.day.title)
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if isCaptureCapsuleOpen && capturePlacement == .pinnedInset {
                captureCapsule
                .padding(.horizontal, 18)
                .padding(.top, 6)
                .padding(.bottom, 8)
                .background(.bar)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .onScrollGeometryChange(for: Bool.self) { geometry in
            geometry.contentOffset.y + geometry.contentInsets.top > 8
        } action: { _, isScrolled in
            isReadingListScrolled = isScrolled
        }
        // Favicons warm as soon as items arrive, off the scroll path, so
        // the first scroll through the list never pays a network fetch or
        // an SVG render per row.
        .task(id: snapshot.items) {
            await FaviconPrefetcher.warm(items: snapshot.items, colorScheme: colorScheme)
        }
        .animation(.snappy(duration: 0.24), value: isCaptureCapsuleOpen)
        .animation(.snappy(duration: 0.24), value: store.pendingSavedItems)
        .animation(.snappy(duration: 0.24), value: snapshot.items)
    }

    private func markOpened(_ item: SavedItem) async {
        // Taken before the save leaves the Inbox, so the Reader View can
        // still step to its neighbours.
        let sequence = store.snapshot(for: .inbox).items.map(\.id)

        withAnimation(.snappy(duration: 0.26)) {
            store.prepareForAnimatedReadStateChange(item)
        }

        await openSavedItem(item, sequence)
    }

    private func setRead(_ item: SavedItem, isRead: Bool) async {
        withAnimation(.snappy(duration: 0.26)) {
            store.prepareForAnimatedReadStateChange(item)
        }

        await store.setRead(item, isRead: isRead)
    }

    private var captureCapsule: some View {
        CaptureCapsuleRow(
            urlText: $captureDraft,
            shouldFocus: shouldFocusCaptureDraft,
            isSaving: isSavingCapture,
            errorMessage: captureErrorMessage
        ) {
            await saveCaptureDraft()
        }
    }

    private func toggleCaptureCapsule() {
        guard !isSavingCapture else { return }

        withAnimation(.snappy(duration: 0.24)) {
            isCaptureCapsuleOpen.toggle()
        }

        if isCaptureCapsuleOpen {
            capturePlacement = isReadingListScrolled ? .pinnedInset : .inlineRow
            let clipboardURL = Self.clipboardURLString()
            captureDraft = clipboardURL ?? ""
            shouldFocusCaptureDraft = clipboardURL == nil
            captureErrorMessage = nil
        } else {
            captureDraft = ""
            shouldFocusCaptureDraft = false
            captureErrorMessage = nil
        }
    }

    private func saveCaptureDraft() async {
        let submittedURL = captureDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Self.isLocallySubmittableURL(submittedURL), !isSavingCapture else { return }

        isSavingCapture = true
        captureErrorMessage = nil
        defer { isSavingCapture = false }

        do {
            _ = try await store.capture(submittedURL)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            closeCaptureCapsule()
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            captureErrorMessage = error.localizedDescription
        }
    }

    private func closeCaptureCapsule() {
        withAnimation(.snappy(duration: 0.24)) {
            isCaptureCapsuleOpen = false
        }
        captureDraft = ""
        shouldFocusCaptureDraft = false
        captureErrorMessage = nil
    }

    private func navigationSubtitleText(unreadCount: Int) -> String? {
        if !store.isOnline { return "Offline" }
        if !store.isAPIReachable { return "Error reaching API" }
        if unreadCount > 0 {
            return "\(unreadCount) unread"
        }

        return nil
    }

    private static func clipboardURLString() -> String? {
        if let url = UIPasteboard.general.url {
            return url.absoluteString
        }

        guard let text = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              isLocallySubmittableURL(text)
        else {
            return nil
        }

        return text
    }

    private static func isLocallySubmittableURL(_ value: String) -> Bool {
        guard !value.isEmpty,
              let url = URL(string: value),
              url.scheme?.isEmpty == false
        else {
            return false
        }

        return true
    }
}

private enum CapturePlacement {
    case inlineRow
    case pinnedInset
}

/// The days the Inbox groups its saves under: today, yesterday, and
/// everything before that.
enum InboxDay: Hashable {
    case today
    case yesterday
    case earlier

    var title: String {
        switch self {
        case .today: "Today"
        case .yesterday: "Yesterday"
        case .earlier: "Earlier"
        }
    }

    struct Group: Identifiable {
        let day: InboxDay
        let items: [SavedItem]

        var id: InboxDay { day }
    }

    /// The saves in their own order, cut where the day changes.
    static func groups(_ items: [SavedItem], calendar: Calendar = .current) -> [Group] {
        var groups: [Group] = []
        for item in items {
            let day: InboxDay = if calendar.isDateInToday(item.lastSavedAt) {
                .today
            } else if calendar.isDateInYesterday(item.lastSavedAt) {
                .yesterday
            } else {
                .earlier
            }

            if let last = groups.last, last.day == day {
                groups[groups.count - 1] = Group(day: day, items: last.items + [item])
            } else if let index = groups.firstIndex(where: { $0.day == day }) {
                groups[index] = Group(day: day, items: groups[index].items + [item])
            } else {
                groups.append(Group(day: day, items: [item]))
            }
        }
        return groups
    }
}
