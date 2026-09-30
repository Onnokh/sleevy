import SwiftUI

/// Organize, the one-off companion to Auto-Filing: it sorts the saves that are
/// already unfiled and may suggest new Folders, named the way the person names
/// theirs. It is a guided sheet: scan, keep or drop the new Folders, review each
/// move, then apply. The run lives on the server, so the sheet may be closed and
/// opened again at the same step; nothing moves until the person applies it.
struct OrganizeView: View {
    let api: SleevyAPIClient

    @Environment(\.dismiss) private var dismiss

    @State private var run: OrganizeRun?
    @State private var folders: [Folder] = []
    @State private var droppedFolders: Set<String> = []
    @State private var skipped: Set<String> = []
    @State private var isReviewing = false
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var result: OrganizeResult?

    private enum Step: Int, Comparable {
        case start, scan, folders, review, done

        static func < (lhs: Step, rhs: Step) -> Bool { lhs.rawValue < rhs.rawValue }
    }

    private struct Group: Identifiable {
        let id: String
        let name: String
        let emoji: String?
        /// The proposed Folder's key, or nil for a Folder the person already has.
        let newFolderKey: String?
        var moves: [OrganizeMove]
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if run != nil {
                    stepper
                        .padding(.horizontal)
                        .padding(.vertical, 12)
                    Divider()
                }
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .id(step)
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
            }
            .animation(.snappy, value: step)
            .safeAreaInset(edge: .bottom) { actionBar }
            .navigationTitle("Organize")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .task { await refresh() }
        .task(id: run?.status) { await pollWhileRunning() }
    }

    // MARK: Steps

    private var step: Step {
        if result != nil { return .done }
        switch run?.status {
        case .running: return .scan
        case .ready where run?.plan != nil: return !newGroups.isEmpty && !isReviewing ? .folders : .review
        default: return .start
        }
    }

    private var steps: [(Step, String)] {
        let hasPlan = run?.plan != nil
        return [(.scan, "Scan")] + (hasPlan && newGroups.isEmpty ? [] : [(.folders, "New Folders")]) + [(.review, "Review")]
    }

    private var stepper: some View {
        HStack(spacing: 6) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, item in
                let (itemStep, label) = item
                let isDone = step > itemStep
                let isCurrent = step == itemStep
                HStack(spacing: 6) {
                    ZStack {
                        Circle()
                            .fill(isCurrent ? Color.primary : .clear)
                            .strokeBorder(isCurrent || isDone ? Color.primary : Color.secondary.opacity(0.4))
                        if isDone {
                            Image(systemName: "checkmark").font(.caption2.weight(.bold))
                        } else {
                            Text("\(index + 1)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(isCurrent ? Color(.systemBackground) : .secondary)
                        }
                    }
                    .frame(width: 20, height: 20)
                    Text(label)
                        .font(.footnote.weight(isCurrent ? .semibold : .regular))
                        .foregroundStyle(isCurrent || isDone ? .primary : .secondary)
                        .fixedSize()
                }
                if index < steps.count - 1 {
                    Rectangle().fill(.secondary.opacity(0.3)).frame(height: 1)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var content: some View {
        switch step {
        case .start: startStep
        case .scan: scanStep
        case .folders: foldersStep
        case .review: reviewStep
        case .done: doneStep
        }
    }

    private var startStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if run == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    Text("Sleevy reads every save that has no folder and finds where it belongs.")
                        .font(.title3.weight(.semibold))
                    explainer(1, "Scan", "Each save is matched against your folders. Where a group of saves fits none, a new folder is suggested, named like yours.")
                    explainer(2, "New Folders", "Keep the suggestions you like and drop the rest.")
                    explainer(3, "Review", "See every move and untick anything that should stay where it is.")
                    Text("Nothing moves until you confirm. The scan runs on its own, so you can close this and come back.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if run?.status == .failed {
                        Text("The last scan could not finish. Nothing was moved.")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    if let errorMessage {
                        Text(errorMessage).font(.footnote).foregroundStyle(.red)
                    }
                }
            }
            .padding()
        }
    }

    private func explainer(_ number: Int, _ title: String, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(number)")
                .font(.footnote.weight(.semibold))
                .frame(width: 22, height: 22)
                .background(Circle().strokeBorder(.secondary.opacity(0.5)))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(text).font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }

    private var scanStep: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let run, run.total > 0 {
                ProgressView(value: Double(run.done), total: Double(run.total)) {
                    Text(run.phase == .proposing ? "Looking for new folders" : run.phase == .filing ? "Sorting saves" : "Getting started")
                        .font(.headline)
                } currentValueLabel: {
                    Text("\(run.done) of \(run.total)").monospacedDigit()
                }
                .animation(.easeOut, value: run.done)
                Text(run.phase == .proposing
                    ? "Checking which groups of saves need a folder you do not have yet."
                    : "Placing each save in the folder it clearly fits. A save that fits none stays unfiled.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ProgressView("Getting started")
                    .frame(maxWidth: .infinity)
            }
            Spacer()
        }
        .padding()
        .padding(.top, 24)
    }

    private var foldersStep: some View {
        List {
            Section {
                ForEach(newGroups) { group in
                    let key = group.newFolderKey ?? ""
                    let keep = !droppedFolders.contains(key)
                    Button {
                        if keep { droppedFolders.insert(key) } else { droppedFolders.remove(key) }
                    } label: {
                        HStack(spacing: 12) {
                            Text(group.emoji ?? "📁")
                                .font(.title3)
                                .frame(width: 36, height: 36)
                                .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(group.name)
                                    .font(.body.weight(.medium))
                                    .strikethrough(!keep)
                                Text("\(saves(group.moves.count)) · \(group.moves.prefix(2).map { $0.title ?? $0.url }.joined(separator: ", "))")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: keep ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(keep ? Color.accentColor : .secondary)
                                .imageScale(.large)
                        }
                        .opacity(keep ? 1 : 0.5)
                        .foregroundStyle(.primary)
                    }
                }
            } header: {
                Text(newGroups.count == 1 ? "1 new folder fits your unfiled saves" : "\(newGroups.count) new folders fit your unfiled saves")
            } footer: {
                Text("Drop any you do not want. Their saves stay unfiled.")
            }
        }
    }

    @ViewBuilder
    private var reviewStep: some View {
        let groups = liveGroups
        if groups.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "tray").font(.largeTitle).foregroundStyle(.secondary)
                Text("None of your \(run?.plan?.considered ?? 0) unfiled saves clearly fits a folder. They stay where they are.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            .padding()
        } else {
            List {
                Section {
                    EmptyView()
                } footer: {
                    Text("\(saves(keptMoves.count)) move, out of \(run?.plan?.considered ?? 0) unfiled saves. Untick anything that should stay where it is.")
                }
                ForEach(groups) { group in
                    Section {
                        ForEach(group.moves) { move in
                            Button {
                                toggle(move.savedItemId)
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: skipped.contains(move.savedItemId) ? "circle" : "checkmark.circle.fill")
                                        .foregroundStyle(skipped.contains(move.savedItemId) ? Color.secondary : Color.accentColor)
                                        .imageScale(.large)
                                    Text(move.title ?? move.url)
                                        .lineLimit(2)
                                        .foregroundStyle(.primary)
                                }
                            }
                        }
                    } header: {
                        HStack(spacing: 6) {
                            Text([group.emoji, group.name].compactMap { $0 }.joined(separator: " "))
                            if group.newFolderKey != nil {
                                Text("New")
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 1)
                                    .overlay(Capsule().stroke(.secondary.opacity(0.5)))
                            }
                        }
                    }
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
        }
    }

    private var doneStep: some View {
        VStack(spacing: 14) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 52))
                .foregroundStyle(Color.accentColor)
                .symbolEffect(.bounce, value: result?.filed)
            if let result {
                Text(result.foldersCreated > 0
                    ? "Moved \(saves(result.filed)) and made \(result.foldersCreated == 1 ? "1 folder" : "\(result.foldersCreated) folders")."
                    : "Moved \(saves(result.filed)).")
                    .font(.title3.weight(.semibold))
                    .multilineTextAlignment(.center)
            }
            Text("New saves go into these folders too when Sort New Saves into Folders is on.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
    }

    // MARK: Action bar

    @ViewBuilder
    private var actionBar: some View {
        let bar: (primary: (String, Bool, () -> Void)?, secondary: (String, () -> Void)?) = {
            switch step {
            case .start:
                return ((run?.status == .failed ? "Try Again" : "Start Scan", run == nil || isWorking, { Task { await start() } }), nil)
            case .scan:
                return (nil, ("Close and Keep Scanning", { dismiss() }))
            case .folders:
                return (("Continue", false, { isReviewing = true }), ("Discard Plan", { Task { await discard() } }))
            case .review:
                guard let plan = run?.plan, !liveGroups.isEmpty else {
                    return (("Done", isWorking, { Task { await discard(); dismiss() } }), nil)
                }
                return (
                    (isWorking ? "Moving…" : "Move \(saves(keptMoves.count))", keptMoves.isEmpty || isWorking, { Task { await apply(plan) } }),
                    newGroups.isEmpty ? ("Discard Plan", { Task { await discard() } }) : ("Back", { isReviewing = false })
                )
            case .done:
                return (("Done", false, { dismiss() }), nil)
            }
        }()

        VStack(spacing: 8) {
            if let primary = bar.primary {
                Button(action: primary.2) {
                    Text(primary.0).frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(primary.1)
            }
            if let secondary = bar.secondary {
                Button(secondary.0, action: secondary.1)
                    .controlSize(.large)
                    .disabled(isWorking)
            }
        }
        .padding()
        .background(.bar)
    }

    // MARK: Plan

    /// One group per target Folder: existing Folders first, then the new ones.
    private var groups: [Group] {
        guard let plan = run?.plan else { return [] }
        let existing = Dictionary(uniqueKeysWithValues: folders.map { ($0.id, $0) })
        var order: [String] = []
        var byId: [String: Group] = [:]
        for move in plan.moves {
            let id = move.folderId ?? "new:\(move.newFolderKey ?? "")"
            if byId[id] == nil {
                let folder = move.folderId.flatMap { existing[$0] }
                let proposed = plan.newFolders.first { $0.key == move.newFolderKey }
                // A Folder deleted since the plan was made has nowhere to go.
                guard folder != nil || proposed != nil else { continue }
                byId[id] = Group(
                    id: id,
                    name: folder?.name ?? proposed?.name ?? "",
                    emoji: folder?.emoji ?? proposed?.emoji,
                    newFolderKey: folder == nil ? proposed?.key : nil,
                    moves: []
                )
                order.append(id)
            }
            byId[id]?.moves.append(move)
        }
        return order.compactMap { byId[$0] }.sorted { $0.newFolderKey == nil && $1.newFolderKey != nil }
    }

    private var newGroups: [Group] { groups.filter { $0.newFolderKey != nil } }

    private var liveGroups: [Group] {
        groups.filter { group in group.newFolderKey.map { !droppedFolders.contains($0) } ?? true }
    }

    private var keptMoves: [OrganizeMove] {
        liveGroups.flatMap(\.moves).filter { !skipped.contains($0.savedItemId) }
    }

    private func toggle(_ id: String) {
        if skipped.contains(id) { skipped.remove(id) } else { skipped.insert(id) }
    }

    private func saves(_ count: Int) -> String {
        count == 1 ? "1 save" : "\(count) saves"
    }

    private func reset() {
        droppedFolders = []
        skipped = []
        isReviewing = false
    }

    // MARK: Actions

    private func refresh() async {
        async let loadedRun = try? api.loadOrganizeRun()
        async let loadedFolders = try? api.loadFolders()
        if let folders = await loadedFolders { self.folders = folders }
        if let run = await loadedRun { self.run = run }
    }

    private func pollWhileRunning() async {
        while run?.status == .running, !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1.5))
            guard !Task.isCancelled, let next = try? await api.loadOrganizeRun() else { continue }
            if next.status == .ready, let folders = try? await api.loadFolders() {
                self.folders = folders
            }
            run = next
        }
    }

    private func start() async {
        isWorking = true
        defer { isWorking = false }
        errorMessage = nil
        result = nil
        reset()
        do {
            run = try await api.startOrganize()
        } catch {
            errorMessage = "Organize is not available right now. Try again later."
        }
    }

    private func discard() async {
        isWorking = true
        defer { isWorking = false }
        if let next = try? await api.discardOrganize() {
            run = next
            reset()
        }
    }

    private func apply(_ plan: OrganizePlan) async {
        isWorking = true
        defer { isWorking = false }
        errorMessage = nil
        let kept = keptMoves
        let keptKeys = Set(kept.compactMap(\.newFolderKey))
        let payload = OrganizeApply(
            newFolders: plan.newFolders.filter { keptKeys.contains($0.key) }.map(OrganizeNewFolderPayload.init),
            moves: kept.map { .init(savedItemId: $0.savedItemId, folderId: $0.folderId, newFolderKey: $0.newFolderKey) }
        )
        do {
            result = try await api.applyOrganize(payload)
            reset()
            run = OrganizeRun(status: .idle, phase: nil, done: 0, total: 0, plan: nil)
        } catch {
            errorMessage = "The saves could not be moved. Try again."
        }
    }
}
