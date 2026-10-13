// Lays screenshots out on a grey sheet, row by row, each scaled to fit one
// cell. Cells are shaped like the Duo's inner display, so a tall cover shot
// and a wide inner shot sit side by side at the same height.
//
//   montage <out.png> <cell-height> <columns> <png...>
import AppKit

let args = CommandLine.arguments
guard args.count > 4, let cellHeight = Double(args[2]), let columns = Int(args[3]), columns > 0 else {
    print("usage: montage <out.png> <cell-height> <columns> <png...>")
    exit(64)
}
let images = args[4...].map { path -> NSImage in
    guard let image = NSImage(contentsOfFile: path) else {
        FileHandle.standardError.write("montage: cannot read \(path)\n".data(using: .utf8)!)
        exit(1)
    }
    return image
}

let h = CGFloat(cellHeight), w = h * 2853 / 2007, pad: CGFloat = 16
let rows = (images.count + columns - 1) / columns
let width = CGFloat(columns) * (w + pad) + pad, height = CGFloat(rows) * (h + pad) + pad
let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: Int(width), pixelsHigh: Int(height), bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
)!
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor(white: 0.85, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()

for (index, image) in images.enumerated() {
    let row = CGFloat(index / columns), column = CGFloat(index % columns)
    let scale = min(w / image.size.width, h / image.size.height)
    let size = NSSize(width: image.size.width * scale, height: image.size.height * scale)
    // AppKit's origin is bottom-left; rows run down from the top.
    let x = pad + column * (w + pad) + (w - size.width) / 2
    let y = height - (row + 1) * (h + pad) + (h - size.height) / 2
    image.draw(in: NSRect(origin: NSPoint(x: x, y: y), size: size))
}
try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[1]))
