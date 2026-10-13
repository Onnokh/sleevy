// Composes one clean iPhone Duo background for the App Store: the Figma
// gradient background with a raw Duo capture in a plain black bezel, like the
// iPad set. render.mjs then draws the localized text on top of it.
//
//   swiftc -O scripts/app-store-screenshots/compose-duo.swift -o /tmp/compose-duo
//   /tmp/compose-duo <background.png> <capture.png|-> <out.png> <width> <height> [deviceWidth deviceTop]
//
// With "-" as the capture, only the background is drawn.
import AppKit

let a = CommandLine.arguments
guard a.count >= 6,
      let bg = NSImage(contentsOfFile: a[1]),
      let W = Int(a[4]), let H = Int(a[5]) else {
    print("usage: compose-duo <bg> <capture|-> <out> <w> <h> [deviceWidth deviceTop]")
    exit(64)
}
let shot = a[2] == "-" ? nil : NSImage(contentsOfFile: a[2])

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H, bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = NSSize(width: W, height: H)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSGraphicsContext.current?.imageInterpolation = .high

// AppKit's origin is bottom-left; work in top-left coordinates.
func rect(_ x: Double, _ y: Double, _ w: Double, _ h: Double) -> NSRect {
    NSRect(x: x, y: Double(H) - y - h, width: w, height: h)
}

func pixelSize(_ image: NSImage) -> NSSize {
    image.representations.first.map { NSSize(width: $0.pixelsWide, height: $0.pixelsHigh) } ?? image.size
}

// Background: scaled to cover the canvas, centered, anchored at the top so the
// logo stays. render.mjs maps the iPad text positions with the same scale.
let bgPixels = pixelSize(bg)
let scale = max(Double(W) / bgPixels.width, Double(H) / bgPixels.height)
let bgW = bgPixels.width * scale, bgH = bgPixels.height * scale
bg.draw(in: rect((Double(W) - bgW) / 2, 0, bgW, bgH))

// Device: black bezel around the capture, with a soft shadow and a thin edge.
if let shot, a.count >= 8, let deviceWidth = Double(a[6]), let deviceTop = Double(a[7]) {
    let shotPixels = pixelSize(shot)
    let bezel = deviceWidth * 0.018
    let screenW = deviceWidth - 2 * bezel
    let screenH = screenW * shotPixels.height / shotPixels.width
    let deviceX = (Double(W) - deviceWidth) / 2
    let outer = rect(deviceX, deviceTop, deviceWidth, screenH + 2 * bezel)
    let outerRadius = deviceWidth * 0.042

    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.55)
    shadow.shadowBlurRadius = 90
    shadow.shadowOffset = NSSize(width: 0, height: -30)
    shadow.set()
    NSColor(srgbRed: 0.04, green: 0.04, blue: 0.05, alpha: 1).setFill()
    NSBezierPath(roundedRect: outer, xRadius: outerRadius, yRadius: outerRadius).fill()
    NSGraphicsContext.restoreGraphicsState()

    let edge = NSBezierPath(roundedRect: outer.insetBy(dx: 2, dy: 2), xRadius: outerRadius - 2, yRadius: outerRadius - 2)
    edge.lineWidth = 4
    NSColor(srgbRed: 0.24, green: 0.24, blue: 0.27, alpha: 1).setStroke()
    edge.stroke()

    let screen = rect(deviceX + bezel, deviceTop + bezel, screenW, screenH)
    NSGraphicsContext.saveGraphicsState()
    let screenRadius = outerRadius - bezel
    NSBezierPath(roundedRect: screen, xRadius: screenRadius, yRadius: screenRadius).addClip()
    shot.draw(in: screen)
    NSGraphicsContext.restoreGraphicsState()
}

NSGraphicsContext.restoreGraphicsState()

// App Store Connect rejects screenshots with an alpha channel: flatten to RGB.
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.draw(rep.cgImage!, in: CGRect(x: 0, y: 0, width: W, height: H))
let flat = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! flat.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[3]))
print("\(a[3]) \(W)x\(H)")
