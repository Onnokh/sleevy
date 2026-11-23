import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// What the device learned about a page for a Local Library save: the
/// Saved Metadata from the page's tags, its Readable Content when it is
/// prose, and, on a device with Apple Intelligence, a Preview Summary and
/// Tags from the on-device model.
nonisolated struct PageEnrichment: Sendable {
    var title: String?
    var description: String?
    var siteName: String?
    var faviconURL: String?
    var readableMarkdown: String?
    var summary: String?
    var tags: [String] = []
}

/// Enrichment on the device, for a Local Library. The server does this for
/// an Account (fetch, Content Check, the Jev classifier); here the phone
/// fetches the page itself and asks the on-device model. A device without
/// Apple Intelligence gets the page's own title and description, no Tags.
nonisolated enum LocalEnricher {
    /// The closed Tag vocabulary of ADR 0024, with what each Tag covers.
    static let tagScopes: [(tag: String, scope: String)] = [
        ("ai", "artificial intelligence, machine learning, LLMs, agents, prompts, AI tools and platforms"),
        ("tools", "developer tooling, CLIs, SDKs, libraries, package managers, build tools"),
        ("typescript", "TypeScript, JavaScript, Node.js, Deno, Bun, React, frontend frameworks"),
        ("security", "security, authentication, encryption, vulnerabilities, CVEs, OAuth"),
        ("design", "visual design, UI/UX, typography, color, layout, Figma, graphic design"),
        ("backend", "databases, servers, infrastructure, APIs, queues, DevOps, cloud"),
        ("front-end", "CSS, browser APIs, HTML, web components, accessibility, responsive design"),
    ]

    /// Fetches and reads the page. Nil when the page could not be fetched.
    static func enrich(url: URL) async -> PageEnrichment? {
        guard let html = await fetch(url) else { return nil }
        let page = HTMLPage(html: html, url: url)

        var result = PageEnrichment(
            title: page.title,
            description: page.description,
            siteName: page.siteName,
            faviconURL: page.faviconURL?.absoluteString,
            readableMarkdown: page.readableMarkdown
        )

        if let reading = await OnDeviceModel.read(
            title: result.title,
            description: result.description,
            text: page.readableText ?? result.description
        ) {
            result.summary = reading.summary
            result.tags = reading.tags
        }
        return result
    }

    /// Whether the on-device model can write summaries and Tags here.
    static var hasOnDeviceModel: Bool { OnDeviceModel.isAvailable }

    private static func fetch(_ url: URL) async -> String? {
        var request = URLRequest(url: url, timeoutInterval: 15)
        request.setValue(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
            forHTTPHeaderField: "User-Agent"
        )
        request.setValue("text/html,application/xhtml+xml", forHTTPHeaderField: "Accept")
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, (200..<400).contains(http.statusCode)
        else { return nil }
        // A page is HTML; a PDF or an image has no tags to read.
        if let type = http.value(forHTTPHeaderField: "Content-Type"), !type.contains("html") {
            return ""
        }
        return String(data: data.prefix(3_000_000), encoding: .utf8)
            ?? String(data: data.prefix(3_000_000), encoding: .isoLatin1)
    }
}

// MARK: - The on-device model

nonisolated private enum OnDeviceModel {
    struct Reading {
        let summary: String
        let tags: [String]
    }

    static var isAvailable: Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            if case .available = SystemLanguageModel.default.availability { return true }
        }
        #endif
        return false
    }

    static func read(title: String?, description: String?, text: String?) async -> Reading? {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            return await readWithFoundationModels(title: title, description: description, text: text)
        }
        #endif
        return nil
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    @Generable
    struct PageReading {
        @Guide(description: "One or two plain sentences that say what the page is about, for someone who decides whether to read it later. No marketing words, no 'This article'.")
        var summary: String

        @Guide(description: "The topics from the list that the page is clearly about. Leave it empty when no topic fits well.", .maximumCount(3))
        var topics: [Topic]
    }

    @available(iOS 26.0, *)
    @Generable
    enum Topic {
        case ai, tools, typescript, security, design, backend, frontEnd

        var tag: String {
            switch self {
            case .ai: "ai"
            case .tools: "tools"
            case .typescript: "typescript"
            case .security: "security"
            case .design: "design"
            case .backend: "backend"
            case .frontEnd: "front-end"
            }
        }
    }

    @available(iOS 26.0, *)
    private static func readWithFoundationModels(title: String?, description: String?, text: String?) async -> Reading? {
        guard case .available = SystemLanguageModel.default.availability else { return nil }
        let source = [title, description, text].compactMap { $0 }.joined(separator: "\n\n")
        guard source.count > 40 else { return nil }

        let scopes = LocalEnricher.tagScopes
            .map { "- \($0.tag == "front-end" ? "frontEnd" : $0.tag): \($0.scope)" }
            .joined(separator: "\n")
        let session = LanguageModelSession(instructions: """
            You read web pages that a person saved to read later. Write a short, \
            neutral summary of the page, and pick the topics it is clearly about \
            from this list:
            \(scopes)
            """)
        // The on-device model has a small context: the start of the page is
        // enough for a summary.
        let prompt = "Page:\n\(String(source.prefix(6_000)))"
        guard let response = try? await session.respond(to: prompt, generating: PageReading.self) else {
            return nil
        }
        let summary = response.content.summary.trimmingCharacters(in: .whitespacesAndNewlines)
        return Reading(
            summary: summary,
            tags: Array(Set(response.content.topics.map(\.tag))).sorted()
        )
    }
    #endif
}

// MARK: - Reading the HTML

/// A light reader of a page's HTML: its tags, and its prose. Not a full
/// Readability port: it keeps the paragraphs and headings of the article.
nonisolated private struct HTMLPage {
    let html: String
    let url: URL

    var title: String? {
        meta("og:title") ?? meta("twitter:title") ?? firstMatch(#"<title[^>]*>([\s\S]*?)</title>"#).map(Self.text)
    }

    var description: String? {
        meta("og:description") ?? meta("description") ?? meta("twitter:description")
    }

    var siteName: String? { meta("og:site_name") }

    var faviconURL: URL? {
        let links = matches(#"<link\b[^>]*>"#)
        let icons = links.compactMap { tag -> (rank: Int, href: String)? in
            let attributes = Self.attributes(tag)
            guard let rel = attributes["rel"]?.lowercased(), rel.contains("icon"),
                  let href = attributes["href"] else { return nil }
            return (rel.contains("apple-touch-icon") ? 0 : 1, href)
        }
        if let best = icons.min(by: { $0.rank < $1.rank }), let resolved = URL(string: best.href, relativeTo: url) {
            return resolved.absoluteURL
        }
        guard let host = url.host else { return nil }
        return URL(string: "https://\(host)/favicon.ico")
    }

    /// The article's prose as Markdown: headings and paragraphs, nil when
    /// the page has too little prose to be read in the Reader View.
    var readableMarkdown: String? {
        let blocks = proseBlocks()
        let markdown = blocks.map { $0.isHeading ? "## \($0.text)" : $0.text }.joined(separator: "\n\n")
        return markdown.count >= 600 ? markdown : nil
    }

    var readableText: String? {
        let text = proseBlocks().map(\.text).joined(separator: "\n")
        return text.isEmpty ? nil : text
    }

    private func proseBlocks() -> [(isHeading: Bool, text: String)] {
        var body = html
        for tag in ["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg"] {
            body = body.replacingOccurrences(
                of: "<\(tag)\\b[\\s\\S]*?</\(tag)>", with: " ", options: [.regularExpression, .caseInsensitive]
            )
        }
        for container in ["article", "main"] {
            if let inner = Self.firstMatch(in: body, "<\(container)\\b[^>]*>([\\s\\S]*?)</\(container)>") {
                body = inner
                break
            }
        }
        return Self.allMatches(in: body, #"<(p|h1|h2|h3|li)\b[^>]*>([\s\S]*?)</\1>"#, groups: [1, 2])
            .compactMap { groups in
                let text = Self.text(groups[1])
                guard text.count > 2 else { return nil }
                return (groups[0].lowercased().hasPrefix("h"), text)
            }
    }

    private func meta(_ name: String) -> String? {
        for tag in matches(#"<meta\b[^>]*>"#) {
            let attributes = Self.attributes(tag)
            let key = (attributes["property"] ?? attributes["name"])?.lowercased()
            if key == name, let content = attributes["content"], !content.isEmpty {
                let value = Self.text(content)
                return value.isEmpty ? nil : value
            }
        }
        return nil
    }

    private func matches(_ pattern: String) -> [String] {
        Self.allMatches(in: html, pattern, groups: [0]).map { $0[0] }
    }

    private func firstMatch(_ pattern: String) -> String? {
        Self.firstMatch(in: html, pattern)
    }

    private static func firstMatch(in source: String, _ pattern: String) -> String? {
        allMatches(in: source, pattern, groups: [1], limit: 1).first?.first
    }

    private static func allMatches(in source: String, _ pattern: String, groups: [Int], limit: Int = .max) -> [[String]] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
        let range = NSRange(source.startIndex..., in: source)
        var results: [[String]] = []
        for match in regex.matches(in: source, range: range) {
            let values = groups.map { group -> String in
                guard let r = Range(match.range(at: group), in: source) else { return "" }
                return String(source[r])
            }
            results.append(values)
            if results.count >= limit { break }
        }
        return results
    }

    private static func attributes(_ tag: String) -> [String: String] {
        var result: [String: String] = [:]
        for groups in allMatches(in: tag, #"([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')"#, groups: [1, 2, 3]) {
            result[groups[0].lowercased()] = groups[1].isEmpty ? groups[2] : groups[1]
        }
        return result
    }

    /// Plain text from an HTML fragment: no tags, entities decoded, spaces
    /// joined.
    static func text(_ fragment: String) -> String {
        var text = fragment.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
        let entities = ["&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&#x27;": "'", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…", "&rsquo;": "’", "&lsquo;": "‘", "&rdquo;": "”", "&ldquo;": "“"]
        for (entity, value) in entities {
            text = text.replacingOccurrences(of: entity, with: value)
        }
        if let regex = try? NSRegularExpression(pattern: "&#(x?[0-9a-fA-F]+);") {
            let range = NSRange(text.startIndex..., in: text)
            for match in regex.matches(in: text, range: range).reversed() {
                guard let whole = Range(match.range, in: text), let code = Range(match.range(at: 1), in: text) else { continue }
                let raw = String(text[code])
                let value = raw.hasPrefix("x") ? UInt32(raw.dropFirst(), radix: 16) : UInt32(raw)
                if let value, let scalar = Unicode.Scalar(value) {
                    text.replaceSubrange(whole, with: String(Character(scalar)))
                }
            }
        }
        return text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
