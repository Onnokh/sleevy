// Composes the still layer of an App Store creative asset video: the white
// Sleevy mark, or raw iPhone captures in a plain black body, on a transparent
// canvas. render.mjs draws the localized text on top of it and lays both over
// glass-loop.swift's moving glass.
//
//   swiftc -O scripts/app-store-screenshots/compose-creative.swift -o /tmp/compose-creative
//   /tmp/compose-creative <spec.json>
//
// spec.json: { width, height, output,
//              mark?: { path, x, y, height },
//              devices: [{ capture, x, y, width }] }
// Coordinates are top-left pixels of the output. A device runs off the bottom
// edge when it is taller than the space below its top.
import AppKit

struct Spec: Decodable {
    struct Mark: Decodable { let path: String; let x, y, height: Double }
    struct Device: Decodable { let capture: String; let x, y, width: Double }
    let width, height: Int
    let output: String
    let mark: Mark?
    let devices: [Device]
}

let spec = try JSONDecoder().decode(Spec.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let W = spec.width, H = spec.height

let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.interpolationQuality = .high

// Core Graphics' origin is bottom-left; work in top-left coordinates.
func rect(_ x: Double, _ y: Double, _ w: Double, _ h: Double) -> CGRect {
    CGRect(x: x, y: Double(H) - y - h, width: w, height: h)
}

func cgImage(_ path: String) -> CGImage {
    guard let image = NSImage(contentsOfFile: path),
          let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fatalError("Cannot read \(path)") }
    return cg
}

if let mark = spec.mark {
    // Draw the SVG at its output size, not as a scaled bitmap.
    guard let image = NSImage(contentsOfFile: mark.path) else { fatalError("Cannot read \(mark.path)") }
    let width = mark.height * image.size.width / image.size.height
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
    image.draw(in: rect(mark.x - width / 2, mark.y, width, mark.height))
    NSGraphicsContext.restoreGraphicsState()
}

// iPhone 18 Pro Max proportions: screen corners at 0.125 of the screen width,
// the Dynamic Island 0.286 wide and 0.025 below the top edge.
for device in spec.devices {
    let shot = cgImage(device.capture)
    let bezel = device.width * 0.03
    let screenW = device.width - 2 * bezel
    let screenH = screenW * Double(shot.height) / Double(shot.width)
    let screenRadius = screenW * 0.125
    let outer = rect(device.x, device.y, device.width, screenH + 2 * bezel)
    let outerRadius = screenRadius + bezel

    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -device.width * 0.03), blur: device.width * 0.09,
                  color: CGColor(gray: 0, alpha: 0.6))
    ctx.setFillColor(CGColor(srgbRed: 0.04, green: 0.04, blue: 0.05, alpha: 1))
    ctx.addPath(CGPath(roundedRect: outer, cornerWidth: outerRadius, cornerHeight: outerRadius, transform: nil))
    ctx.fillPath()
    ctx.restoreGState()

    let edgeWidth = device.width * 0.004
    let edge = outer.insetBy(dx: edgeWidth / 2, dy: edgeWidth / 2)
    ctx.setStrokeColor(CGColor(srgbRed: 0.26, green: 0.26, blue: 0.30, alpha: 1))
    ctx.setLineWidth(edgeWidth)
    ctx.addPath(CGPath(roundedRect: edge, cornerWidth: outerRadius - edgeWidth / 2, cornerHeight: outerRadius - edgeWidth / 2, transform: nil))
    ctx.strokePath()

    let screen = rect(device.x + bezel, device.y + bezel, screenW, screenH)
    ctx.saveGState()
    ctx.addPath(CGPath(roundedRect: screen, cornerWidth: screenRadius, cornerHeight: screenRadius, transform: nil))
    ctx.clip()
    ctx.draw(shot, in: screen)
    ctx.restoreGState()

    let islandW = screenW * 0.286, islandH = screenW * 0.084
    let island = rect(device.x + bezel + (screenW - islandW) / 2, device.y + bezel + screenW * 0.025, islandW, islandH)
    ctx.setFillColor(CGColor(gray: 0, alpha: 1))
    ctx.addPath(CGPath(roundedRect: island, cornerWidth: islandH / 2, cornerHeight: islandH / 2, transform: nil))
    ctx.fillPath()
}

// The layer keeps its alpha; the video it goes on has none, as App Store
// Connect requires.
let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: spec.output) as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(destination, ctx.makeImage()!, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Could not write \(spec.output)") }
print("\(spec.output) \(W)x\(H)")
