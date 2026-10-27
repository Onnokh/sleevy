import Foundation
import Testing
@testable import Sleevy

struct SaveDateGroupTests {
    /// Wednesday 15 October 2025, noon UTC, in a week that starts on Monday.
    private let now = Date(timeIntervalSince1970: 1_760_529_600)
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        calendar.firstWeekday = 2
        return calendar
    }()

    @Test func cutsNewestFirstSavesIntoSpans() {
        let items = [
            item("today", daysAgo: 0),
            item("yesterday", daysAgo: 1),
            item("monday", daysAgo: 2),
            item("last-week", daysAgo: 5),
            item("this-month", daysAgo: 10),
            item("september", daysAgo: 30),
            item("september-too", daysAgo: 40),
            item("august", daysAgo: 50),
            item("last-year", daysAgo: 300),
        ]

        let groups = SaveDateGroup.groups(items, now: now, calendar: calendar)

        #expect(groups.map(\.span) == [.today, .yesterday, .thisWeek, .lastWeek, .thisMonth, .lastMonth, .earlier])
        #expect(groups.map { $0.items.map(\.id) } == [
            ["today"], ["yesterday"], ["monday"], ["last-week"], ["this-month"], ["september", "september-too"], ["august", "last-year"],
        ])
    }

    @Test func keepsOldestFirstOrder() {
        let items = [item("old", daysAgo: 40), item("new", daysAgo: 0)]

        let groups = SaveDateGroup.groups(items, now: now, calendar: calendar)

        #expect(groups.map(\.span) == [.lastMonth, .today])
    }

    private func item(_ id: String, daysAgo: Int) -> SavedItem {
        let date = calendar.date(byAdding: .day, value: -daysAgo, to: now)!
        return SavedItem(
            id: id,
            originalURL: "https://example.com/\(id)",
            normalizedURL: "https://example.com/\(id)",
            host: "example.com",
            title: id,
            description: nil,
            siteName: nil,
            faviconURL: nil,
            faviconLightURL: nil,
            faviconDarkURL: nil,
            canonicalURL: nil,
            previewSummary: nil,
            type: "article",
            tags: [],
            enrichmentStatus: .enriched,
            sourceName: nil,
            captureChannel: nil,
            folder: nil,
            isRead: false,
            lastSavedAt: date,
            createdAt: date,
            updatedAt: date
        )
    }
}
