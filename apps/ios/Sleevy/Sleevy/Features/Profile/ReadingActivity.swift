import SwiftUI

/// Mirror of `GET /v1/public/profiles/:handle/activity`
/// (`ReadingActivityResponse`): first captures per UTC day over a rolling
/// 52 weeks. Only the days that hold a capture are sent.
nonisolated struct ReadingActivity: Decodable, Equatable {
    nonisolated struct Day: Decodable, Equatable {
        /// A UTC day, as `2026-08-13`.
        let date: String
        let count: Int
    }

    let from: String
    let to: String
    let days: [Day]

    var total: Int { days.reduce(0) { $0 + $1.count } }

    /// The captures in each week from Sunday, oldest first. The first and
    /// last week can hold fewer than seven days of the window.
    var weeklyTotals: [Int] {
        guard let first = Self.day(from), let last = Self.day(to), first <= last else { return [] }
        let lead = Self.calendar.component(.weekday, from: first) - 1
        func week(_ date: Date) -> Int {
            ((Self.calendar.dateComponents([.day], from: first, to: date).day ?? 0) + lead) / 7
        }

        var totals = Array(repeating: 0, count: week(last) + 1)
        for day in days {
            guard let date = Self.day(day.date), date >= first, date <= last else { continue }
            totals[week(date)] += day.count
        }
        return totals
    }

    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        return calendar
    }()

    /// `2026-08-13` as the start of that UTC day.
    private static func day(_ text: String) -> Date? {
        let parts = text.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}

/// The Reading Activity of a Public Profile as one bar a week, tallest for
/// the busiest, like the bars of the Sleevy mark. This week is in full ink,
/// so the row reads as a year that ends now.
struct ReadingActivityBars: View {
    let activity: ReadingActivity
    let handle: String

    var body: some View {
        let totals = activity.weeklyTotals

        Canvas { context, size in
            let count = CGFloat(max(totals.count, 1))
            let gap: CGFloat = 0.45
            let width = size.width / (count + (count - 1) * gap)
            let most = CGFloat(max(totals.max() ?? 1, 1))

            for (index, total) in totals.enumerated() {
                // An empty week is a dot, so the row keeps its length.
                let height = max(width, size.height * CGFloat(total) / most)
                let bar = CGRect(x: CGFloat(index) * width * (1 + gap), y: size.height - height, width: width, height: height)
                let strength = index == totals.count - 1 ? 0.95 : total == 0 ? 0.12 : 0.4
                context.fill(Path(roundedRect: bar, cornerRadius: width / 2), with: .color(.primary.opacity(strength)))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("@\(handle) has sleeved \(activity.total) \(activity.total == 1 ? "link" : "links") in the last year")
    }
}
