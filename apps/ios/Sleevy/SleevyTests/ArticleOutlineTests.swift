import Foundation
import Testing

@testable import Sleevy

/// The same suite as `apps/web/test/reader/article-outline.test.ts`.
///
/// Both halves of the Article Outline are pure and platform-free on purpose:
/// they are the part the iOS app re-implements rather than re-designs, so the
/// two clients are held to one set of answers rather than to whichever one was
/// read first.
@Suite("Article Outline")
struct ArticleOutlineTests {
    private func sections(_ titles: String...) -> String {
        titles.map { "## \($0)\n\nA paragraph under \($0)." }.joined(separator: "\n\n")
    }

    @Test("takes the shallowest level that carries enough headings")
    func shallowestLevelThatCarriesEnoughHeadings() {
        // The h1 is the article's own title and the sections are under it.
        // Taking the shallowest level outright would answer with a rail of one
        // mark and lose the outline the article really has.
        let markdown = ["# Built for humans", sections("First", "Second", "Third")].joined(separator: "\n\n")

        #expect(articleOutline(markdown).map(\.title) == ["First", "Second", "Third"])
    }

    @Test("has no outline for an article with too few headings to be one")
    func tooFewHeadingsIsNoOutline() {
        #expect(articleOutline(sections("Only", "Two")).isEmpty)
        #expect(articleOutline("Prose with no headings at all.").isEmpty)
    }

    @Test("ignores a heading inside a fenced code block")
    func headingInsideAFenceIsNotASection() {
        let markdown = [
            sections("First", "Second", "Third"),
            "```sh",
            "# install it first",
            "## not a section",
            "```",
        ].joined(separator: "\n\n")

        #expect(articleOutline(markdown).map(\.title) == ["First", "Second", "Third"])
    }

    @Test("reads a heading as the words it renders as")
    func headingIsReadAsPlainWords() {
        let markdown = [
            "## [Microfilm](https://example.com/blog/microfilm)",
            "\nWhat the card was pointing at.",
            sections("Second", "Third"),
        ].joined(separator: "\n")

        let first = articleOutline(markdown).first
        #expect(first?.title == "Microfilm")
        #expect(first?.id == "microfilm")
    }

    @Test("gives two sections of the same name two ids")
    func duplicateTitlesGetDistinctIDs() {
        let outline = articleOutline(sections("Notes", "Other", "Notes"))
        #expect(outline.map(\.id) == ["notes", "other", "notes-2"])
    }

    @Test("points back at the heading's own line, not at its slug")
    func entryCarriesTheHeadingsLine() {
        let markdown = ["Intro.", "", "## First", "", "Body.", "", "## Second", "", "Body.", "", "## Third"]
            .joined(separator: "\n")
        // The article is cut into sections at these lines, so each one has to
        // be the line its heading is really on.
        #expect(articleOutline(markdown).map(\.line) == [3, 7, 11])
    }

    @Test("carries the opening of each section, and nothing when there is none")
    func excerptOpensEachSection() {
        let markdown = [
            "## First",
            "",
            "The first thing the section says.",
            "",
            "## Second",
            "### Straight into a sub-heading",
            "",
            "## Third",
            "",
            "- A list opens this one.",
        ].joined(separator: "\n")

        #expect(articleOutline(markdown).map(\.excerpt) == [
            "The first thing the section says.",
            "",
            "A list opens this one.",
        ])
    }
}

@Suite("Article sections")
struct ArticleSectionsTests {
    @Test("cuts the article at its headings, with the opening under no entry")
    func cutsAtHeadings() {
        let markdown = ["Intro.", "", "## First", "", "One.", "", "## Second", "", "Two.", "", "## Third", "", "Three."]
            .joined(separator: "\n")
        let outline = articleOutline(markdown)
        let sections = articleSections(markdown: markdown, outline: outline)

        #expect(sections.map(\.entryID) == [nil, "first", "second", "third"])
        #expect(sections[0].markdown.contains("Intro."))
        #expect(sections[1].markdown.hasPrefix("## First"))
        #expect(sections[3].markdown.contains("Three."))
    }

    @Test("keeps an article with no outline whole")
    func noOutlineIsOneSection() {
        let markdown = "Just prose, no headings."
        let sections = articleSections(markdown: markdown, outline: articleOutline(markdown))

        #expect(sections.count == 1)
        #expect(sections[0].entryID == nil)
        #expect(sections[0].markdown == markdown)
    }

    @Test("loses none of the article")
    func everyLineSurvivesTheCut() {
        let markdown = ["# Title", "", "Lead.", "", "## A", "", "Body A.", "", "## B", "", "Body B.", "", "## C", "", "Body C."]
            .joined(separator: "\n")
        let sections = articleSections(markdown: markdown, outline: articleOutline(markdown))

        // Rejoined, the sections are the article again — a cut that drops a
        // line would lose prose the reader is meant to read.
        #expect(sections.map(\.markdown).joined(separator: "\n") == markdown)
    }
}

@Suite("Active outline entry")
struct ActiveOutlineIndexTests {
    private let tops: [CGFloat] = [1000, 2000, 3000]
    private let viewport: CGFloat = 800

    @Test("marks the first section at the top of the article")
    func firstSectionAtTheTop() {
        // A rail that opens with nothing lit reads as one that is not working,
        // and a reader above the first heading is on their way into that
        // section rather than into any other.
        #expect(activeOutlineIndex(tops: tops, scrollTop: 0, viewportHeight: viewport, contentHeight: 4000) == 0)
    }

    @Test("moves on as each heading reaches the reading line")
    func movesOnAtTheReadingLine() {
        #expect(activeOutlineIndex(tops: tops, scrollTop: 1000 - readingLine - 1, viewportHeight: viewport, contentHeight: 9000) == 0)
        #expect(activeOutlineIndex(tops: tops, scrollTop: 1000 - readingLine, viewportHeight: viewport, contentHeight: 9000) == 0)
        #expect(activeOutlineIndex(tops: tops, scrollTop: 2000 - readingLine - 1, viewportHeight: viewport, contentHeight: 9000) == 0)
        #expect(activeOutlineIndex(tops: tops, scrollTop: 2000 - readingLine, viewportHeight: viewport, contentHeight: 9000) == 1)
        #expect(activeOutlineIndex(tops: tops, scrollTop: 3000 - readingLine, viewportHeight: viewport, contentHeight: 9000) == 2)
    }

    @Test("claims the last section at the end of the article")
    func lastSectionAtTheEnd() {
        // A closing section shorter than the reading line is deep never
        // travels far enough to claim its own mark, so the rail would stop one
        // short however far the reader scrolled.
        #expect(activeOutlineIndex(tops: [100, 200, 3950], scrollTop: 3200, viewportHeight: viewport, contentHeight: 4000) == 2)
    }

    @Test("has no answer for an article with no outline")
    func noOutlineHasNoAnswer() {
        // The only -1 there is, and an article with no outline draws no rail
        // for it to answer for.
        #expect(activeOutlineIndex(tops: [], scrollTop: 0, viewportHeight: viewport, contentHeight: 4000) == -1)
    }
}
