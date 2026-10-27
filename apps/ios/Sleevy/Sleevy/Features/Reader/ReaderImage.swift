import MarkdownUI
import SwiftUI
import UIKit

/// The Reader View's images, in place of MarkdownUI's: a photo or a figure
/// set as part of the page, not dropped into it.
struct ReaderImageProvider: ImageProvider {
    func makeImage(url: URL?) -> some View {
        ReaderImage(url: url)
    }
}

/// One image of an article, loaded from its External Image URL.
///
/// A figure fills the column, with soft corners and a hairline edge so a dark
/// photo does not run into a dark page or a white one into a light page, and
/// a tap opens it on a screen of its own to zoom in. A small image, such as
/// an icon or a badge, keeps its own size. One that cannot load is left out,
/// as the page would have no gap for it either.
struct ReaderImage: View {
    let url: URL?

    @State private var phase: Phase
    @State private var isViewerShown = false
    @Namespace private var viewer

    /// No taller than this, so a long screenshot does not take several
    /// screens of the article.
    private static let maxHeight: CGFloat = 560

    /// Narrower than this, in pixels, an image is an icon or a badge and not
    /// a figure.
    private static let figureWidth: CGFloat = 320

    private static let corner = RoundedRectangle(cornerRadius: 10, style: .continuous)

    /// Decoded images, so a section drawn again, as for a new Text Size, does
    /// not show its placeholders again.
    private static let cache = NSCache<NSURL, UIImage>()

    private enum Phase {
        case loading
        case loaded(UIImage)
        case failed
    }

    init(url: URL?) {
        self.url = url
        _phase = State(initialValue: url.flatMap { Self.cache.object(forKey: $0 as NSURL) }.map(Phase.loaded) ?? .loading)
    }

    var body: some View {
        Group {
            switch phase {
            case .loading:
                Self.corner
                    .fill(Color(.secondarySystemBackground))
                    .aspectRatio(3 / 2, contentMode: .fit)
                    .frame(maxWidth: .infinity)
            case .loaded(let image) where image.size.width >= Self.figureWidth:
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .clipShape(Self.corner)
                    .overlay { Self.corner.strokeBorder(.primary.opacity(0.1), lineWidth: 1) }
                    .contentShape(Self.corner)
                    .onTapGesture { isViewerShown = true }
                    .accessibilityAddTraits(.isButton)
                    .accessibilityHint("Opens the image to zoom in")
                    .matchedTransitionSource(id: "image", in: viewer)
                    .frame(maxWidth: .infinity, maxHeight: Self.maxHeight)
                    .transition(.opacity)
                    .fullScreenCover(isPresented: $isViewerShown) {
                        ReaderImageViewer(image: image)
                            .navigationTransition(.zoom(sourceID: "image", in: viewer))
                    }
            case .loaded(let image):
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: image.size.width, alignment: .leading)
                    .transition(.opacity)
            case .failed:
                EmptyView()
            }
        }
        .task(id: url) { await load() }
    }

    private func load() async {
        guard case .loading = phase else { return }
        guard let url, ["http", "https"].contains(url.scheme?.lowercased()) else {
            phase = .failed
            return
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let image = await UIImage(data: data)?.byPreparingForDisplay() else {
                phase = .failed
                return
            }
            Self.cache.setObject(image, forKey: url as NSURL)
            withAnimation(.easeOut(duration: 0.2)) { phase = .loaded(image) }
        } catch {
            // A section that scrolls away cancels its load; it starts again
            // when the section comes back.
            if !Task.isCancelled { phase = .failed }
        }
    }
}
