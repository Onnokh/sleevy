import MarkdownUI
import SwiftUI

/// The face the Reader View sets an article in. Serif and sans read equally
/// well; serif is the default because it is the book face, as in Apple Books.
enum ReaderFont: String, CaseIterable, Identifiable {
    /// New York.
    case serif
    /// San Francisco, the face of the rest of the app.
    case sans

    var id: Self { self }

    var title: String {
        switch self {
        case .serif: "Serif"
        case .sans: "Sans"
        }
    }

    var design: Font.Design {
        switch self {
        case .serif: .serif
        case .sans: .default
        }
    }
}

/// The measures an article is set to, all from its body size, so a larger
/// Text Size keeps the same shape and the same number of words to a line.
struct ReaderType {
    let bodySize: CGFloat
    let font: ReaderFont

    /// About 66 characters to a line in either face. Past this the eye loses
    /// its place on the way back to the start of the next line.
    var measure: CGFloat { bodySize * 34 }

    /// The article's title: big enough to be the start of the page, and not
    /// so big that a long title fills the screen.
    var titleSize: CGFloat { (bodySize * 1.8).rounded() }

    /// Where the article is from and the labels around it, in the app's face.
    var metaSize: CGFloat { (bodySize * 0.82).rounded() }

    /// A code block. Monospaced letters are wide and tall for their point
    /// size, so code set at the body size looks a step larger than the prose
    /// and fits few characters to a line.
    var codeSize: CGFloat { (bodySize * 0.78).rounded() }

    /// One line of prose: the unit for the space between blocks.
    var line: CGFloat { bodySize * 1.5 }

    /// The space a line of text gets above its own glyphs, for a line height
    /// of 1.5. Both faces are about 1.2 tall without it.
    var lineSpacing: CGFloat { bodySize * 0.3 }

    /// The space above a section, so that a heading sits with the text it
    /// starts and not with the text that ends before it.
    var sectionSpacing: CGFloat { line * 1.75 }

    /// Prose in near-black or near-white, not gray and not pure: full white on
    /// black glows at the edges of each letter, and gray prose is hard to read
    /// for long.
    static let prose = Color.primary.opacity(0.88)
}

extension MarkdownUI.Theme {
    /// Reader typography: one column of calm prose at a line height of 1.5,
    /// and headings with more space above than below. Semantic colors
    /// throughout, so the Theme setting (System / Light / Dark) governs the
    /// Reader View too.
    static func sleevyReader(_ type: ReaderType) -> MarkdownUI.Theme {
        let line = type.line

        return MarkdownUI.Theme()
            .text {
                FontFamily(.system(type.font.design))
                FontSize(type.bodySize)
                ForegroundColor(ReaderType.prose)
            }
            .code {
                FontFamily(.system(.monospaced))
                FontSize(.em(0.85))
            }
            .strong {
                FontWeight(.semibold)
                ForegroundColor(.primary)
            }
            .link {
                ForegroundColor(ReaderType.prose)
                UnderlineStyle(.init(pattern: .solid, color: .secondary))
            }
            .heading1 { configuration in
                configuration.label
                    .markdownMargin(top: type.sectionSpacing, bottom: line * 0.4)
                    .markdownTextStyle { FontWeight(.bold); FontSize(.em(1.45)); ForegroundColor(.primary) }
            }
            .heading2 { configuration in
                configuration.label
                    .markdownMargin(top: type.sectionSpacing, bottom: line * 0.4)
                    .markdownTextStyle { FontWeight(.bold); FontSize(.em(1.25)); ForegroundColor(.primary) }
            }
            .heading3 { configuration in
                configuration.label
                    .markdownMargin(top: line * 1.25, bottom: line * 0.4)
                    .markdownTextStyle { FontWeight(.semibold); FontSize(.em(1.1)); ForegroundColor(.primary) }
            }
            .paragraph { configuration in
                configuration.label
                    .lineSpacing(type.lineSpacing)
                    .markdownMargin(top: 0, bottom: line * 0.8)
            }
            .listItem { configuration in
                configuration.label
                    .markdownMargin(top: line * 0.25)
            }
            .image { configuration in
                configuration.label
                    .markdownMargin(top: line, bottom: line)
            }
            // Set back and a step smaller, and upright: a long quote in
            // italics is harder to read than the prose around it.
            .blockquote { configuration in
                configuration.label
                    .padding(.leading, 16)
                    .overlay(alignment: .leading) {
                        Rectangle()
                            .fill(Color.secondary.opacity(0.35))
                            .frame(width: 3)
                    }
                    .markdownTextStyle { FontSize(.em(0.95)) }
                    .markdownMargin(top: line, bottom: line)
            }
            // Code keeps its own line breaks and colours: a long line scrolls
            // sideways instead of wrapping. The file it is from, where the
            // page named one, labels the top of its frame.
            .codeBlock { configuration in
                let fileName = configuration.language.flatMap(codeFileName)
                let language = configuration.language?.split(separator: " ").first.map(String.init)
                VStack(alignment: .leading, spacing: 0) {
                    if let fileName {
                        Text(fileName)
                            .font(.system(size: (type.codeSize * 0.9).rounded(), design: .monospaced))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 14)
                            .padding(.top, 12)
                    }
                    ScrollView(.horizontal) {
                        // cmark ends the code with the newline before the
                        // closing fence, which would draw an empty last line.
                        ReaderCode(code: configuration.content.trimmingCharacters(in: .newlines), language: language)
                            .font(.system(size: type.codeSize, design: .monospaced))
                            .lineSpacing(type.codeSize * 0.3)
                            .padding(.horizontal, 14)
                            .padding(.top, fileName == nil ? 14 : 8)
                            .padding(.bottom, 14)
                    }
                    .scrollIndicators(.hidden)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12, style: .continuous))
                .markdownMargin(top: line, bottom: line)
            }
    }
}

/// The file a code block is from. The extractor writes it into the fence after
/// the language, as `ts title="review.ts"`, and MarkdownUI hands the whole of
/// that over as the language.
private func codeFileName(_ info: String) -> String? {
    info.firstMatch(of: #/title="([^"]+)"/#).map { String($0.1) }
}
