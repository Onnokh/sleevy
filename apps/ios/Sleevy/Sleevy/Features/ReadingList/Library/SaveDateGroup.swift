import Foundation

/// The span of time a Library list groups its saves under while it is sorted
/// by date: today, yesterday, the rest of this week, last week, the rest of
/// this month, last month, and everything before that. Early in a week, This
/// Week can be empty: on a Tuesday, its only other day is Yesterday.
nonisolated enum SaveDateSpan: Hashable, Sendable {
    case today
    case yesterday
    case thisWeek
    case lastWeek
    case thisMonth
    case lastMonth
    case earlier

    var title: String {
        switch self {
        case .today: "Today"
        case .yesterday: "Yesterday"
        case .thisWeek: "This Week"
        case .lastWeek: "Last Week"
        case .thisMonth: "This Month"
        case .lastMonth: "Last Month"
        case .earlier: "Earlier"
        }
    }
}

/// One run of saves under a date heading.
nonisolated struct SaveDateGroup: Identifiable, Sendable {
    let span: SaveDateSpan
    let items: [SavedItem]

    var id: SaveDateSpan { span }

    /// The saves in their own order, cut where the span changes.
    static func groups(
        _ items: [SavedItem],
        now: Date = .now,
        calendar: Calendar = .current
    ) -> [SaveDateGroup] {
        var groups: [SaveDateGroup] = []
        for item in items {
            let span = span(of: item.lastSavedAt, now: now, calendar: calendar)

            if let index = groups.firstIndex(where: { $0.span == span }) {
                groups[index] = SaveDateGroup(span: span, items: groups[index].items + [item])
            } else {
                groups.append(SaveDateGroup(span: span, items: [item]))
            }
        }
        return groups
    }

    private static func span(of date: Date, now: Date, calendar: Calendar) -> SaveDateSpan {
        if calendar.isDate(date, inSameDayAs: now) { return .today }
        if let yesterday = calendar.date(byAdding: .day, value: -1, to: now),
           calendar.isDate(date, inSameDayAs: yesterday) {
            return .yesterday
        }
        if calendar.isDate(date, equalTo: now, toGranularity: .weekOfYear) { return .thisWeek }
        if let lastWeek = calendar.date(byAdding: .weekOfYear, value: -1, to: now),
           calendar.isDate(date, equalTo: lastWeek, toGranularity: .weekOfYear) {
            return .lastWeek
        }
        if calendar.isDate(date, equalTo: now, toGranularity: .month) { return .thisMonth }
        if let lastMonth = calendar.date(byAdding: .month, value: -1, to: now),
           calendar.isDate(date, equalTo: lastMonth, toGranularity: .month) {
            return .lastMonth
        }
        return .earlier
    }
}
