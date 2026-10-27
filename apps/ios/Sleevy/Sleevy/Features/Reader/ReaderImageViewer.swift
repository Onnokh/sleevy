import SwiftUI
import UIKit

/// An article's image on a screen of its own, opened from a tap on it: a
/// pinch or a double tap zooms in, and a drag moves around the zoomed image.
struct ReaderImageViewer: View {
    let image: UIImage

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZoomableImage(image: image)
                .ignoresSafeArea()
                .background(.black)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Close", systemImage: "xmark") { dismiss() }
                    }
                }
                .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        }
        // Dark here only: the rest of the app keeps the reader's appearance.
        .environment(\.colorScheme, .dark)
        .accessibilityAction(.escape) { dismiss() }
    }
}

/// A scroll view that zooms its image, which SwiftUI has no view for. At its
/// smallest the image fits the screen, centred; a double tap zooms in to the
/// point tapped, or out again.
private struct ZoomableImage: UIViewRepresentable {
    let image: UIImage

    func makeUIView(context: Context) -> ZoomingScrollView {
        ZoomingScrollView(image: image)
    }

    func updateUIView(_ view: ZoomingScrollView, context: Context) {}
}

private final class ZoomingScrollView: UIScrollView, UIScrollViewDelegate {
    private let imageView: UIImageView
    private var fittedBounds: CGSize = .zero

    init(image: UIImage) {
        imageView = UIImageView(image: image)
        super.init(frame: .zero)

        delegate = self
        minimumZoomScale = 1
        maximumZoomScale = 4
        bouncesZoom = true
        showsVerticalScrollIndicator = false
        showsHorizontalScrollIndicator = false
        contentInsetAdjustmentBehavior = .never
        decelerationRate = .fast

        imageView.contentMode = .scaleAspectFit
        imageView.isAccessibilityElement = true
        addSubview(imageView)

        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(doubleTapped))
        doubleTap.numberOfTapsRequired = 2
        addGestureRecognizer(doubleTap)
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        // A new size, as on a turn of the device, starts over at the fit.
        guard bounds.size != fittedBounds, let size = imageView.image?.size,
              size.width > 0, size.height > 0 else { return }
        fittedBounds = bounds.size

        zoomScale = 1
        let scale = min(bounds.width / size.width, bounds.height / size.height)
        imageView.frame = CGRect(x: 0, y: 0, width: size.width * scale, height: size.height * scale)
        contentSize = imageView.frame.size
        centre()
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        imageView
    }

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        centre()
    }

    /// Keeps an image smaller than the screen in the middle of it.
    private func centre() {
        let x = max(0, (bounds.width - contentSize.width) / 2)
        let y = max(0, (bounds.height - contentSize.height) / 2)
        contentInset = UIEdgeInsets(top: y, left: x, bottom: y, right: x)
    }

    @objc private func doubleTapped(_ recognizer: UITapGestureRecognizer) {
        if zoomScale > minimumZoomScale {
            setZoomScale(minimumZoomScale, animated: true)
            return
        }
        let point = recognizer.location(in: imageView)
        let scale = min(maximumZoomScale, 2.5)
        let size = CGSize(width: bounds.width / scale, height: bounds.height / scale)
        zoom(to: CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height), animated: true)
    }
}
