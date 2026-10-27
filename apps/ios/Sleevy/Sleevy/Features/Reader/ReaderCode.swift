import Highlightr
import SwiftUI
import UIKit

/// The code of a code block, coloured for the language it is in.
///
/// It shows as plain text first and takes its colours when the highlighter
/// is done, so a long listing never holds up the scroll. The language is
/// the first word of the fence's info; where the page gave none, which is
/// most code on the web, the highlighter tells it from the code itself.
struct ReaderCode: View {
    let code: String
    let language: String?

    @Environment(\.colorScheme) private var colorScheme
    @State private var loaded: Highlighted?

    /// Coloured code by its text, language, and appearance, so a section drawn
    /// again, as for a new Text Size, does not lose its colours for a moment.
    private static let cache = NSCache<NSString, Highlighted>()

    var body: some View {
        let key = "\(colorScheme)\n\(language ?? "")\n\(code)" as NSString
        let highlighted = Self.cache.object(forKey: key) ?? loaded.flatMap { $0.key == key ? $0 : nil }

        Text(highlighted?.text ?? AttributedString(code))
            .task(id: key) {
                guard Self.cache.object(forKey: key) == nil,
                      let text = await CodeHighlighter.shared.highlight(code, language: language, dark: colorScheme == .dark)
                else { return }
                let result = Highlighted(key: key, text: text)
                Self.cache.setObject(result, forKey: key)
                loaded = result
            }
    }
}

private final class Highlighted {
    let key: NSString
    let text: AttributedString

    init(key: NSString, text: AttributedString) {
        self.key = key
        self.text = text
    }
}

/// highlight.js, run off the main thread. It is one JavaScript context, which
/// runs one call at a time, so the actor queues the calls.
private actor CodeHighlighter {
    static let shared = CodeHighlighter()

    /// Loaded at the first code block, not at launch: the script is large.
    private lazy var highlightr = Highlightr()
    private var theme: String?

    /// Longer than this, the colours are not worth the time a guess at the
    /// language takes.
    private static let maxLength = 20_000

    /// The code's colours only. The font and the frame are the Reader View's,
    /// so a coloured block is the same size and shape as a plain one.
    func highlight(_ code: String, language: String?, dark: Bool) -> AttributedString? {
        guard code.count <= Self.maxLength, let highlightr else { return nil }

        let name = dark ? "xcode-dark" : "xcode"
        if theme != name {
            guard highlightr.setTheme(to: name) else { return nil }
            theme = name
        }

        guard let source = highlightr.highlight(code, as: language) else { return nil }

        var text = AttributedString(source.string)
        source.enumerateAttribute(.foregroundColor, in: NSRange(location: 0, length: source.length)) { value, range, _ in
            guard let color = value as? UIColor,
                  let range = Range(range, in: text) else { return }
            text[range].foregroundColor = Color(uiColor: color)
        }
        return text
    }
}
