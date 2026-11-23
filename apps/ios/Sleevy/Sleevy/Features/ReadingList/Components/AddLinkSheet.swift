import SwiftUI
import UIKit

extension View {
    /// The Add Link button, the last item of the top bar on every list
    /// screen, and the Capture Sheet it opens. One button in one place, and
    /// one sheet, wherever the reader is.
    func addLinkButton(store: ReadingListStore) -> some View {
        modifier(AddLinkButton(store: store))
    }
}

private struct AddLinkButton: ViewModifier {
    var store: ReadingListStore
    @State private var isPresented = false

    func body(content: Content) -> some View {
        content
            .toolbarPreferringVerticalBar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Add Link", systemImage: "plus") {
                        isPresented = true
                    }
                }
            }
            .sheet(isPresented: $isPresented) {
                // The plain sheet: a zoom from the button travels across a
                // wide window, and with the keyboard it is too much motion.
                CaptureSheet(store: store)
            }
    }
}

/// The Capture Sheet: a small sheet with one URL field. When the clipboard
/// holds a link, the system Paste button saves it in one tap. The sheet never
/// reads the clipboard itself, so iOS does not ask to allow pasting.
struct CaptureSheet: View {
    @Environment(\.dismiss) private var dismiss
    var store: ReadingListStore
    @State private var urlText = ""
    @State private var clipboardHasLink = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @FocusState private var isFieldFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: "link")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.secondary)

                    TextField("Paste or type URL", text: $urlText)
                        .focused($isFieldFocused)
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.done)
                        .disabled(isSaving)
                        .onSubmit(save)

                    if clipboardHasLink && urlText.isEmpty && !isSaving {
                        // Paste saves at once: the copied link is the save.
                        PasteButton(payloadType: URL.self) { urls in
                            guard let url = urls.first else { return }
                            Task { @MainActor in
                                urlText = url.absoluteString
                                save()
                            }
                        }
                        .buttonBorderShape(.capsule)
                        .labelStyle(.titleAndIcon)
                        .controlSize(.small)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 14, style: .continuous))

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                } else if clipboardHasLink && urlText.isEmpty {
                    Text("Paste saves the link you copied.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 20)
            .navigationTitle("Add Link")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark", role: .cancel) {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Save", systemImage: "checkmark", action: save)
                            .disabled(!canSave)
                    }
                }
            }
        }
        .presentationDetents([.height(200)])
        // In a wide window: a form sheet's width, as tall as its content.
        .presentationSizing(.form.fitted(horizontal: false, vertical: true))
        .presentationDragIndicator(.hidden)
        .interactiveDismissDisabled(isSaving)
        .task {
            // Asks only whether the clipboard looks like a link, which iOS
            // allows without the paste prompt.
            let patterns = try? await UIPasteboard.general.detectedPatterns(for: [\.probableWebURL])
            clipboardHasLink = patterns?.contains(\.probableWebURL) ?? false
            if !clipboardHasLink { isFieldFocused = true }
        }
    }

    private var trimmed: String {
        urlText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSave: Bool {
        !isSaving && Self.isLocallySubmittableURL(trimmed)
    }

    private func save() {
        guard canSave else { return }
        isSaving = true
        errorMessage = nil

        Task {
            defer { isSaving = false }
            do {
                _ = try await store.capture(trimmed)
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
            } catch {
                UINotificationFeedbackGenerator().notificationOccurred(.error)
                errorMessage = error.localizedDescription
            }
        }
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
