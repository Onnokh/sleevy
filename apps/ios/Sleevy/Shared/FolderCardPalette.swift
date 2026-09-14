import Foundation

// Lives in `Shared/` because the Unread Widget colours a Folder's tile with
// the same palette the app's folder cards wear.
/// The palette a folder card gradient wears: a deep ground tone, the carrying
/// mid colour, and a highlight the field reaches for at its brightest. The
/// folder's chosen accent colour decides which palette a card gets.
///
/// Each palette is a scheme, not one hue: the highlight sits a hue over from
/// the mid (red walks into amber, blue into violet, purple into pink), the
/// way the Inbox aurora walks blue -> purple -> pink. Every stop is softened
/// toward pastel so the coronas keep the aurora's calm instead of shouting
/// next to it.
nonisolated struct FolderCardPalette: Equatable, Sendable {
    let deep: SIMD3<Float>
    let mid: SIMD3<Float>
    let highlight: SIMD3<Float>

    /// Crimson into amber.
    static let red = FolderCardPalette(
        deep: SIMD3(0.30, 0.07, 0.09),
        mid: SIMD3(0.82, 0.34, 0.20),
        highlight: SIMD3(1.0, 0.74, 0.46)
    )

    /// Ember into gold.
    static let orange = FolderCardPalette(
        deep: SIMD3(0.32, 0.15, 0.05),
        mid: SIMD3(0.86, 0.52, 0.24),
        highlight: SIMD3(1.0, 0.86, 0.58)
    )

    /// Ochre into pale gold.
    static let yellow = FolderCardPalette(
        deep: SIMD3(0.30, 0.23, 0.07),
        mid: SIMD3(0.84, 0.68, 0.32),
        highlight: SIMD3(1.0, 0.94, 0.68)
    )

    /// Forest into mint-teal.
    static let green = FolderCardPalette(
        deep: SIMD3(0.05, 0.24, 0.15),
        mid: SIMD3(0.34, 0.68, 0.48),
        highlight: SIMD3(0.68, 0.94, 0.78)
    )

    /// Deep sea into cyan.
    static let teal = FolderCardPalette(
        deep: SIMD3(0.03, 0.20, 0.24),
        mid: SIMD3(0.24, 0.58, 0.62),
        highlight: SIMD3(0.62, 0.88, 0.92)
    )

    /// Midnight into violet.
    static let blue = FolderCardPalette(
        deep: SIMD3(0.07, 0.11, 0.30),
        mid: SIMD3(0.32, 0.46, 0.84),
        highlight: SIMD3(0.70, 0.74, 0.98)
    )

    /// Violet into pink.
    static let purple = FolderCardPalette(
        deep: SIMD3(0.20, 0.09, 0.36),
        mid: SIMD3(0.58, 0.42, 0.86),
        highlight: SIMD3(0.92, 0.70, 0.90)
    )

    /// Rose into blush.
    static let pink = FolderCardPalette(
        deep: SIMD3(0.30, 0.08, 0.18),
        mid: SIMD3(0.82, 0.40, 0.56),
        highlight: SIMD3(1.0, 0.78, 0.82)
    )

    /// Slate into moonlight.
    static let neutral = FolderCardPalette(
        deep: SIMD3(0.16, 0.18, 0.23),
        mid: SIMD3(0.52, 0.57, 0.67),
        highlight: SIMD3(0.88, 0.91, 0.97)
    )

    /// The palette for a Folder's stored colour name; neutral when the
    /// Folder has no colour or names one this build does not know.
    static func named(_ color: String?) -> FolderCardPalette {
        switch color {
        case "red": .red
        case "orange": .orange
        case "yellow": .yellow
        case "green": .green
        case "teal": .teal
        case "blue": .blue
        case "purple": .purple
        case "pink": .pink
        default: .neutral
        }
    }
}
