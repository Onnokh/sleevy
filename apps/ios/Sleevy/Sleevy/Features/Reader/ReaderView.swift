import MarkdownUI
import SwiftUI

/// The in-product surface that renders a Saved Item's Readable Content instead
/// of sending the reader to the Original URL (ADR 0021).
///
/// Only Markdown is rendered. The extractor's HTML is never served, so nothing
/// here sanitizes third-party markup — that is the whole reason the contract
/// serves one form and not the other.
///
/// The Original URL is always one tap away, so the Reader View is never a dead
/// end: an extraction that lost the part you wanted is a tap from the page.
struct ReaderView: View {
    let item: SavedItem
    let load: (String) async throws(SyncFault) -> ReadableContent

    @State private var phase: Phase = .loading
    @Environment(\.openURL) private var openURL

    enum Phase: Equatable {
        case loading
        case loaded(ReadableContent)
        case failed(String)
    }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .loaded(let content):
                article(content)
            case .failed(let reason):
                unavailable(reason)
            }
        }
        .navigationTitle(item.title ?? item.host)
        .navigationBarTitleDisplayMode(.inline)
        // The one screen in the app that hides the tab bar. Everywhere else
        // content scrolling under the floating bar is fine; here it sits on
        // top of the last lines of the article, and a reading surface should
        // be the article and nothing else.
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Open in Browser", systemImage: "safari") { openOriginal() }
                    if case .loaded(let content) = phase {
                        ShareLink(item: URL(string: content.originalURL) ?? url) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                    }
                } label: {
                    Label("More", systemImage: "ellipsis.circle")
                }
            }
        }
        .task { await loadContent() }
    }

    // MARK: - States

    private func article(_ content: ReadableContent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // The article's own title, not the row's: the extractor read
                // the page and the Saved Metadata read the tags, and when they
                // disagree the page is the one that was written by a person.
                Text(content.title ?? item.title ?? item.host)
                    .font(.largeTitle.weight(.bold))

                Text(item.host)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Markdown(content.markdown)
                    .markdownTheme(.sleevyReader)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 48)
        }
    }

    private func unavailable(_ reason: String) -> some View {
        ContentUnavailableView {
            Label("Can't read this here", systemImage: "doc.text.magnifyingglass")
        } description: {
            Text(reason)
        } actions: {
            Button("Open in Browser") { openOriginal() }
                .buttonStyle(.borderedProminent)
        }
    }

    // MARK: - Behaviour

    private var url: URL {
        URL(string: item.originalURL) ?? URL(string: "https://\(item.host)")!
    }

    private func openOriginal() {
        openURL(url)
    }

    private func loadContent() async {
        // A Post has no Readable Content and never will: extraction gets
        // nothing from a client-rendered timeline. Capture already resolved
        // the message, so render that rather than asking for an article the
        // server will answer 404 for.
        if !item.hasReadableContent, item.type == "post" {
            phase = .loaded(Self.postContent(for: item))
            return
        }

        do {
            phase = .loaded(try await load(item.id))
        } catch {
            // A 404 here is ordinary — extraction is best effort — so this
            // reads as an absence rather than a failure to report.
            phase = .failed("Sleevy couldn't extract this page's text. The original is still there.")
        }
    }

    /// A Post is its own preview: the message capture resolved, rendered as the
    /// article. Mirrors the Web Companion, which gives a Post a Reader View for
    /// the same reason.
    private static func postContent(for item: SavedItem) -> ReadableContent {
        ReadableContent(
            savedItemId: item.id,
            originalURL: item.originalURL,
            title: item.title,
            markdown: item.description ?? item.previewSummary ?? "",
            extractedAt: item.lastSavedAt
        )
    }
}

// MARK: - Theme

extension MarkdownUI.Theme {
    /// Reader typography: one column, generous leading, and a measure that
    /// stays readable when the Duo unfolds. Semantic colors throughout, so the
    /// Theme setting (System / Light / Dark) governs the Reader View too.
    static let sleevyReader = MarkdownUI.Theme()
        .text {
            FontSize(17)
            ForegroundColor(.primary)
        }
        .code {
            FontFamilyVariant(.monospaced)
            FontSize(.em(0.92))
        }
        .link {
            ForegroundColor(.accentColor)
        }
        .heading1 { configuration in
            configuration.label
                .markdownMargin(top: 28, bottom: 10)
                .markdownTextStyle { FontWeight(.bold); FontSize(.em(1.5)) }
        }
        .heading2 { configuration in
            configuration.label
                .markdownMargin(top: 24, bottom: 8)
                .markdownTextStyle { FontWeight(.semibold); FontSize(.em(1.28)) }
        }
        .heading3 { configuration in
            configuration.label
                .markdownMargin(top: 20, bottom: 6)
                .markdownTextStyle { FontWeight(.semibold); FontSize(.em(1.1)) }
        }
        .paragraph { configuration in
            configuration.label
                .lineSpacing(6)
                .markdownMargin(top: 0, bottom: 14)
        }
        .blockquote { configuration in
            configuration.label
                .padding(.leading, 14)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(Color.secondary.opacity(0.35))
                        .frame(width: 3)
                }
                .markdownTextStyle { FontStyle(.italic); ForegroundColor(.secondary) }
        }
}
