import SwiftUI

/// The homepage's glass, live (SleevyGlass.metal): satin ribbons in the dark
/// under slow, wandering lights, dark at the bottom where the words stand.
/// Behind the sign-in screens and the save sheet.
///
/// Kept light on the GPU: the glass is an out-of-focus field, so it is drawn
/// small (a sixth of the screen's pixels on each side) and scaled up, as the
/// web draws it at 1x; it runs at 30 frames a second; and the screen-door
/// grid over it is drawn once, not on every frame. Reduce Motion and Low
/// Power Mode get the glass held still.
struct SleevyGlassBackdrop: View {
    /// The glass at one moment, drawn in place of the live glass where the
    /// GPU may not keep up: no shader runs and nothing is drawn again.
    var still: Image? = nil
    /// Where the glass is lit, and how strongly, at a moment; nil, or a nil
    /// answer, lets the light roam.
    var light: ((Date) -> SleevyGlassLight?)?

    static let ground = Color(red: 8 / 255, green: 9 / 255, blue: 12 / 255)
    /// Points per rendered pixel of the glass.
    private static let pointsPerPixel: CGFloat = 2

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date.now
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

    var body: some View {
        let held = reduceMotion || lowPower
        ZStack {
            Self.ground
            if let still {
                still.resizable()
            } else {
                GeometryReader { proxy in
                    let small = CGSize(
                        width: ceil(proxy.size.width / Self.pointsPerPixel),
                        height: ceil(proxy.size.height / Self.pointsPerPixel)
                    )
                    TimelineView(.animation(minimumInterval: 1 / 30, paused: held)) { context in
                        let seconds = held ? 0 : context.date.timeIntervalSince(start)
                        let lit = light?(context.date)
                        Rectangle()
                            .colorEffect(ShaderLibrary.sleevyGlass(
                                .float2(small),
                                .float(seconds),
                                .float2(lit.map { CGPoint(x: $0.point.x, y: 1 - $0.point.y) } ?? Self.roam(seconds)),
                                .float(lit?.strength ?? 0.25)
                            ))
                            .frame(width: small.width, height: small.height)
                            // Drawn off screen at one pixel per two points, then
                            // scaled up: the field is soft, the GPU does a
                            // thirty-sixth of the work.
                            .drawingGroup(opaque: true)
                            .environment(\.displayScale, 1)
                            .scaleEffect(Self.pointsPerPixel, anchor: .topLeading)
                    }
                }
            }
            ScreenDoor()
            LinearGradient(
                stops: [
                    .init(color: Self.ground.opacity(0.1), location: 0),
                    .init(color: Self.ground.opacity(0.45), location: 0.38),
                    .init(color: Self.ground.opacity(0.92), location: 0.62),
                    .init(color: Self.ground, location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
    }

    /// The web's roaming light, with no pointer: a slow loop over the glass.
    private static func roam(_ seconds: Double) -> CGPoint {
        CGPoint(x: 0.5 + 0.2 * sin(seconds * 0.21), y: 0.46 + 0.2 * sin(seconds * 0.33 + 1.1))
    }
}

/// The screen-door over the glass, as the web's CSS draws it: 4 pt cells with
/// a darker line on two sides. Static, so it is drawn once.
private struct ScreenDoor: View {
    var body: some View {
        Canvas { context, size in
            var lines = Path()
            for x in stride(from: 0, through: size.width, by: 4) {
                lines.addRect(CGRect(x: x, y: 0, width: 1, height: size.height))
            }
            for y in stride(from: 0, through: size.height, by: 4) {
                lines.addRect(CGRect(x: 0, y: y, width: size.width, height: 1))
            }
            context.fill(lines, with: .color(.black.opacity(0.15)))
        }
        .allowsHitTesting(false)
    }
}

/// A light over the glass: where, as a unit point from the top left, and how
/// strong (the roaming light is 0.25).
struct SleevyGlassLight: Equatable {
    var point: CGPoint
    var strength: Double
}
