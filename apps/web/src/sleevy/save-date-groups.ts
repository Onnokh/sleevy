import { isSameDay, isSameMonth, isSameWeek, subDays, subMonths, subWeeks } from "date-fns"

/**
 * The span of time a list groups its saves under while it is sorted by date,
 * as the iOS app does (SaveDateGroup.swift): today, yesterday, the rest of
 * this week, last week, the rest of this month, last month, and everything
 * before that. Early in a week, This Week can be empty.
 */
export type SaveDateSpan = "Today" | "Yesterday" | "This Week" | "Last Week" | "This Month" | "Last Month" | "Earlier"

export type SaveDateGroup<Item> = {
  readonly span: SaveDateSpan
  readonly items: readonly Item[]
}

// The week starts on Monday, as the iOS calendar does for most readers.
const week = { weekStartsOn: 1 } as const

export function saveDateSpan(date: Date, now: Date): SaveDateSpan {
  if (isSameDay(date, now)) return "Today"
  if (isSameDay(date, subDays(now, 1))) return "Yesterday"
  if (isSameWeek(date, now, week)) return "This Week"
  if (isSameWeek(date, subWeeks(now, 1), week)) return "Last Week"
  if (isSameMonth(date, now)) return "This Month"
  if (isSameMonth(date, subMonths(now, 1))) return "Last Month"
  return "Earlier"
}

/** The saves in their own order, cut where the span changes. */
export function saveDateGroups<Item extends { readonly lastSavedAt: string }>(
  items: readonly Item[],
  now: Date = new Date(),
): readonly SaveDateGroup<Item>[] {
  const groups: { span: SaveDateSpan; items: Item[] }[] = []
  for (const item of items) {
    const span = saveDateSpan(new Date(item.lastSavedAt), now)
    const group = groups.find((candidate) => candidate.span === span)
    if (group) group.items.push(item)
    else groups.push({ span, items: [item] })
  }
  return groups
}
