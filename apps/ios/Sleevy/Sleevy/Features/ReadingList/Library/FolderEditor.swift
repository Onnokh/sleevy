import SwiftUI

enum FolderEditor: Identifiable {
    case create
    case rename(Folder)

    var id: String {
        switch self {
        case .create: "create"
        case .rename(let folder): "rename-\(folder.id)"
        }
    }

    var title: String {
        switch self {
        case .create: "New Folder"
        case .rename: "Edit Folder"
        }
    }

    var initialName: String {
        switch self {
        case .create: ""
        case .rename(let folder): folder.name
        }
    }

    var initialEmoji: String? {
        switch self {
        case .create: nil
        case .rename(let folder): folder.emoji
        }
    }

    var initialColor: String? {
        switch self {
        case .create: nil
        case .rename(let folder): folder.color
        }
    }
}

struct FolderEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    let editor: FolderEditor
    let onSave: @MainActor (FolderDraft) async throws -> Void
    @State private var name: String
    /// No longer editable — carried through so a rename never clears an
    /// emoji or colour a folder already has from before the pickers were
    /// removed. The web app still shows the colour.
    private let selectedEmoji: String?
    private let selectedColor: String?
    @State private var errorMessage: String?
    @State private var isSaving = false

    init(editor: FolderEditor, onSave: @escaping @MainActor (FolderDraft) async throws -> Void) {
        self.editor = editor
        self.onSave = onSave
        _name = State(initialValue: editor.initialName)
        selectedEmoji = editor.initialEmoji
        selectedColor = editor.initialColor
    }

    var body: some View {
        FolderEditorDrawer(
            title: editor.title,
            isSaveDisabled: trimmedName.isEmpty || name.count > 80 || isSaving,
            onCancel: { dismiss() },
            onSave: save
        ) {
            VStack(spacing: 22) {
                TextField("Folder name", text: $name)
                    .textInputAutocapitalization(.words)
                    .font(.body)
                    .padding(.horizontal, 14)
                    .frame(height: 48)
                    .frame(maxWidth: .infinity)
                    .background(
                        Color(uiColor: .secondarySystemBackground),
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                    )
                    .padding(.top, 14)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .presentationDetents([.height(200), .large])
        .presentationDragIndicator(.visible)
        .presentationContentInteraction(.scrolls)
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func save() {
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                try await onSave(FolderDraft(
                    name: trimmedName,
                    emoji: selectedEmoji,
                    color: selectedColor
                ))
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct FolderEditorDrawer<Content: View>: View {
    let title: String
    let isSaveDisabled: Bool
    let onCancel: () -> Void
    let onSave: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        NavigationStack {
            ScrollView {
                content
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 28)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: onSave)
                        .disabled(isSaveDisabled)
                }
            }
        }
    }
}

struct FolderDraft {
    let name: String
    let emoji: String?
    let color: String?
}
