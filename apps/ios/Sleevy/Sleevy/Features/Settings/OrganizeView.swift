import SwiftUI

/// Organize, the one-off companion to Auto-Filing: it sorts the saves that are
/// already unfiled and may suggest new Folders, named the way the person names
/// theirs. The run lives on the server, so this screen may be left and opened
/// again; nothing moves until the person applies the plan.
struct OrganizeView: View {
    let api: SleevyAPIClient

    @State private var run: OrganizeRun?
    @State private var folders: [Folder] = []
    @State private var skipped: Set<String> = []
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var resultMessage: String?

    private struct Group: Identifiable {
        let id: String
        let name: String
        let emoji: String?
        let isNew: Bool
        var moves: [OrganizeMove]
    }

    var body: some View {
        Form {
            switch run?.status {
            case nil:
                ProgressView()
                    .frame(maxWidth: .infinity)
            case .running:
                runningSection
            case .ready:
                if let plan = run?.plan {
                    planSections(plan)
                }
            case .idle, .failed:
                startSection
            }
        }
        .navigationTitle("Organize")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if run?.status == .ready, let plan = run?.plan, !groups(plan).isEmpty {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Move \(keptMoves.count)") {
                        Task { await apply(plan) }
                    }
                    .disabled(keptMoves.isEmpty || isWorking)
                }
            }
        }
        .task { await refresh() }
        .task(id: run?.status) { await pollWhileRunning() }
    }

    // MARK: Sections

    private var startSection: some View {
        Section {
            Button {
                Task { await start() }
            } label: {
                Text(run?.status == .failed ? "Try Again" : "Organize Unfiled Saves")
            }
            .disabled(isWorking)
        } footer: {
            VStack(alignment: .leading, spacing: 8) {
                Text("Sorts every save without a folder into the folder it clearly fits. Where a group of saves fits none, it suggests a new folder named like yours. You see the plan before anything moves.")
                if run?.status == .failed {
                    Text("The last run could not finish. Nothing was moved.")
                        .foregroundStyle(.red)
                }
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red)
                }
                if let resultMessage {
                    Text(resultMessage).foregroundStyle(.primary)
                }
            }
        }
    }

    private var runningSection: some View {
        Section {
            if let run, run.total > 0 {
                ProgressView(value: Double(run.done), total: Double(run.total)) {
                    Text(run.phase == .proposing ? "Looking for new folders" : run.phase == .filing ? "Sorting saves" : "Getting started")
                } currentValueLabel: {
                    Text("\(run.done) of \(run.total)")
                }
            } else {
                ProgressView("Starting")
            }
        } footer: {
            Text("This runs on its own. You can leave this screen and come back.")
        }
    }

    @ViewBuilder
    private func planSections(_ plan: OrganizePlan) -> some View {
        let groups = groups(plan)
        if groups.isEmpty {
            Section {
                Button("Done") { Task { await discard() } }
            } footer: {
                Text("None of your \(plan.considered) unfiled saves clearly fits a folder. They stay where they are.")
            }
        } else {
            Section {
                EmptyView()
            } footer: {
                Text("\(plan.moves.count) of \(plan.considered) unfiled saves have a place. Untick anything that should stay where it is.")
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
                        if group.isNew {
                            Text("New")
                                .font(.caption2.weight(.semibold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 1)
                                .overlay(Capsule().stroke(.secondary.opacity(0.5)))
                        }
                    }
                }
            }

            Section {
                Button("Discard Plan", role: .destructive) {
                    Task { await discard() }
                }
                .disabled(isWorking)
            } footer: {
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }
        }
    }

    // MARK: Plan

    /// One group per target Folder: existing Folders first, then the new ones.
    private func groups(_ plan: OrganizePlan) -> [Group] {
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
                    isNew: folder == nil,
                    moves: []
                )
                order.append(id)
            }
            byId[id]?.moves.append(move)
        }
        return order.compactMap { byId[$0] }.sorted { !$0.isNew && $1.isNew }
    }

    private var keptMoves: [OrganizeMove] {
        guard let plan = run?.plan else { return [] }
        return groups(plan).flatMap(\.moves).filter { !skipped.contains($0.savedItemId) }
    }

    private func toggle(_ id: String) {
        if skipped.contains(id) { skipped.remove(id) } else { skipped.insert(id) }
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
            run = next
            if next.status == .ready, let folders = try? await api.loadFolders() {
                self.folders = folders
            }
        }
    }

    private func start() async {
        isWorking = true
        defer { isWorking = false }
        errorMessage = nil
        resultMessage = nil
        skipped = []
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
            skipped = []
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
            let result = try await api.applyOrganize(payload)
            skipped = []
            run = OrganizeRun(status: .idle, phase: nil, done: 0, total: 0, plan: nil)
            let saves = result.filed == 1 ? "1 save" : "\(result.filed) saves"
            resultMessage = result.foldersCreated > 0
                ? "Moved \(saves) and made \(result.foldersCreated == 1 ? "1 folder" : "\(result.foldersCreated) folders")."
                : "Moved \(saves)."
        } catch {
            errorMessage = "The saves could not be moved. Try again."
        }
    }
}
