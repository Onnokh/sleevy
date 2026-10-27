import SwiftUI
import UIKit

/// One published Saved Item: a Post Card for a post, a Link Card for any
/// other Type, with its image beside it. A public item just opens, copies,
/// or shares.
struct PublicSavedItemCard: View {
    let item: PublicSavedItem
    let type: ReaderType

    var body: some View {
        Button {
            guard let url = URL(string: item.originalUrl) else { return }
            UIApplication.shared.open(url)
        } label: {
            HStack(alignment: .top, spacing: 16) {
                Group {
                    if item.type == "post" {
                        postCard
                    } else {
                        linkCard
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if let imageURL = item.imageUrl.flatMap(URL.init(string:)) {
                    ProfileThumbnail(url: imageURL, size: thumbnailSize)
                        .padding(.top, 2)
                }
            }
            .contentShape(.rect)
            .padding(.vertical, type.cardPadding)
        }
        .buttonStyle(.plain)
        .contextMenu {
            if let url = URL(string: item.originalUrl) {
                ShareLink(item: url, preview: SharePreview(item.title ?? item.host)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }

                Button {
                    UIPasteboard.general.url = url
                } label: {
                    Label("Copy Link", systemImage: "link")
                }
            }
        }
    }

    /// The title is a headline for something else, so it leads, under where
    /// it is from and over the Preview Summary.
    private var linkCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                SavedItemFavicon(
                    faviconURL: item.faviconUrl.flatMap(URL.init(string:)),
                    monogram: String(displayHost.prefix(1)).uppercased(),
                    size: type.smallSize + 2
                )
                .clipShape(.rect(cornerRadius: 4, style: .continuous))

                Text(displayHost)
                    .font(.system(size: type.smallSize))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(height: type.bylineHeight)

            Text(item.title ?? item.originalUrl)
                .font(.system(size: type.bodySize, weight: .semibold, design: type.font.design))
                .lineSpacing(type.cardLineSpacing)
                .foregroundStyle(.primary)
                .lineLimit(2)
                .padding(.top, type.bylineGap)

            // The title and its summary are one thought, so they sit closer
            // than the title does to where it is from.
            if let summary {
                Text(summary)
                    .font(.system(size: type.smallSize))
                    .lineSpacing(type.cardLineSpacing)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .padding(.top, 2)
            }
        }
    }

    /// The message is the words the reader came for, so it is set as prose
    /// under the Link Author who wrote it, and never as a headline: one long
    /// post would shout down every card around it.
    private var postCard: some View {
        let name = item.authorName ?? item.authorHandle ?? displayHost

        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                ProfileAuthorAvatar(
                    url: item.authorAvatarUrl.flatMap(URL.init(string:)),
                    name: name,
                    size: type.bylineHeight
                )

                Text(name)
                    .font(.system(size: type.smallSize, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                if let handle = item.authorHandle, handle != name {
                    Text(handle)
                        .font(.system(size: type.smallSize))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(height: type.bylineHeight)

            Text(item.title ?? "Post by \(name)")
                .font(.system(size: type.bodySize, design: type.font.design))
                .lineSpacing(type.cardLineSpacing)
                .foregroundStyle(ReaderType.prose)
                .lineLimit(4)
                .padding(.top, type.bylineGap)
        }
    }

    /// As tall as a card of three lines, which most are: a taller image
    /// would push the next card down and make the gaps uneven.
    private var thumbnailSize: CGFloat { (type.line * 2.5).rounded() }

    private var summary: String? {
        let text = item.previewSummary?.trimmingCharacters(in: .whitespacesAndNewlines)
        return text?.isEmpty == false ? text : nil
    }

    private var displayHost: String {
        item.host.replacingOccurrences(
            of: #"^www\."#,
            with: "",
            options: .regularExpression
        )
    }
}

/// The Link Author's picture, or the first letter of the name where there
/// is none or it cannot load.
private struct ProfileAuthorAvatar: View {
    let url: URL?
    let name: String
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().fill(Color(.tertiarySystemFill))
            Text(String(name.prefix(1)).uppercased())
                .font(.system(size: size * 0.5, weight: .semibold))
                .foregroundStyle(.secondary)
            if let url {
                ProfileThumbnail(url: url, size: size, shape: Circle())
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A remote image cut to a square, made only as large as it is drawn: a
/// page's cover image is often 1200 pixels wide, and decoding that for each
/// row would hold up the scroll. One that cannot load leaves no gap.
struct ProfileThumbnail<Shape: InsettableShape>: View {
    let url: URL
    let size: CGFloat
    var shape: Shape

    @Environment(\.displayScale) private var displayScale
    @State private var phase = Phase.loading

    private enum Phase {
        case loading
        case loaded(UIImage)
        case failed
    }

    var body: some View {
        let key = "\(Int(size * displayScale))\n\(url.absoluteString)" as NSString
        let image = ThumbnailCache.shared.object(forKey: key) ?? {
            if case .loaded(let image) = phase { image } else { nil }
        }()

        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size, height: size)
                    .clipShape(shape)
                    .overlay { shape.strokeBorder(.primary.opacity(0.1), lineWidth: 1) }
                    .transition(.opacity)
            } else if case .failed = phase {
                EmptyView()
            } else {
                shape
                    .fill(Color(.secondarySystemBackground))
                    .frame(width: size, height: size)
            }
        }
        .accessibilityHidden(true)
        .task(id: key) {
            guard ThumbnailCache.shared.object(forKey: key) == nil else { return }
            await load(key: key)
        }
    }

    private func load(key: NSString) async {
        guard ["http", "https"].contains(url.scheme?.lowercased()) else {
            phase = .failed
            return
        }

        do {
            let data = try await RemoteImageDiskCache.shared.data(for: url)
            let side = size * displayScale
            guard let source = UIImage(data: data),
                  let image = await source.byPreparingThumbnail(ofSize: Self.fill(source.size, side: side))
            else {
                phase = .failed
                return
            }
            ThumbnailCache.shared.setObject(image, forKey: key)
            withAnimation(.easeOut(duration: 0.2)) { phase = .loaded(image) }
        } catch {
            // A row that scrolls away cancels its load; it starts again when
            // the row comes back.
            if !Task.isCancelled { phase = .failed }
        }
    }

    /// The image's own shape, scaled so its shorter side fills the square.
    private static func fill(_ size: CGSize, side: CGFloat) -> CGSize {
        guard size.width > 0, size.height > 0 else { return CGSize(width: side, height: side) }
        let scale = side / min(size.width, size.height)
        return CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
    }
}

extension ProfileThumbnail where Shape == RoundedRectangle {
    init(url: URL, size: CGFloat) {
        self.init(url: url, size: size, shape: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

/// Thumbnails by address and pixel size. Out here because a generic view
/// cannot hold a static stored property.
private enum ThumbnailCache {
    static let shared = NSCache<NSString, UIImage>()
}
