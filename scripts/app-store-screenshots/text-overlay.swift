// Draws the localized text of one App Store screenshot into a transparent PNG,
// for render.mjs to lay over a clean background. Core Text shapes the text, so
// Arabic and Hebrew run right to left and join, Indic and Thai marks stack, and
// a glyph the chosen font lacks falls back to a font that has it.
//
//   text-overlay <spec.json>
//
// spec.json: { width, height, output, family, tracking, safeArea,
//              texts: [{ value, x, y, width, fontSize, weight, color }] }
import AppKit

struct Spec: Decodable {
    struct Text: Decodable {
        let value: String
        let x, y, width, fontSize: Double
        let weight: Int
        let color: String
    }
    let width, height: Int
    let output: String
    let family: String
    let tracking: Double
    let safeArea: Double
    let texts: [Text]
}

let spec = try JSONDecoder().decode(Spec.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))

let ctx = CGContext(data: nil, width: spec.width, height: spec.height, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.textMatrix = .identity

for text in spec.texts {
    let lines = text.value.components(separatedBy: "\n")
    // Tracking scales with the font size, so the width does too: shrink the
    // font in proportion until the widest line fits the safe area of its box.
    let widest = lines.map { typeset($0, text, size: text.fontSize).width }.max() ?? 0
    let usable = text.width * spec.safeArea
    let size = widest > usable ? text.fontSize * usable / widest : text.fontSize
    let ascender = font(size: size, weight: text.weight).ascender

    for (index, value) in lines.enumerated() {
        let (line, width) = typeset(value, text, size: size)
        let top = text.y - size * 0.1 + Double(index) * size * 1.02
        ctx.textPosition = CGPoint(x: text.x + (text.width - width) / 2, y: Double(spec.height) - top - ascender)
        CTLineDraw(line, ctx)
    }
}

let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: spec.output) as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(destination, ctx.makeImage()!, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("Could not write \(spec.output)") }

func typeset(_ value: String, _ text: Spec.Text, size: Double) -> (line: CTLine, width: Double) {
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font(size: size, weight: text.weight),
        .foregroundColor: color(text.color),
        .tracking: size * spec.tracking,
    ]
    let line = CTLineCreateWithAttributedString(NSAttributedString(string: value, attributes: attributes))
    return (line, CTLineGetTypographicBounds(line, nil, nil, nil))
}

/// The locale's family at the nearest weight, or the system font (SF Pro)
/// when the family is ".SF NS" or not installed.
func font(size: Double, weight: Int) -> NSFont {
    if spec.family != ".SF NS" {
        let manager = NSFontManager.shared
        let managerWeight = weight >= 700 ? 9 : weight >= 500 ? 6 : 5
        if let font = manager.font(withFamily: spec.family, traits: [], weight: managerWeight, size: size)
            ?? manager.font(withFamily: spec.family, traits: weight >= 700 ? .boldFontMask : [], weight: 5, size: size) {
            return font
        }
    }
    let systemWeight: NSFont.Weight = weight >= 700 ? .bold : weight >= 600 ? .semibold : weight >= 500 ? .medium : .regular
    return NSFont.systemFont(ofSize: size, weight: systemWeight)
}

func color(_ hex: String) -> CGColor {
    let value = Int(hex.dropFirst(), radix: 16) ?? 0xffffff
    return CGColor(srgbRed: Double((value >> 16) & 0xff) / 255, green: Double((value >> 8) & 0xff) / 255,
                   blue: Double(value & 0xff) / 255, alpha: 1)
}
