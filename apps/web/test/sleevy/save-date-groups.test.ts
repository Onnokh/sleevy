import { describe, expect, test } from "bun:test"

import { saveDateGroups, saveDateSpan } from "../../src/sleevy/save-date-groups"

// A Wednesday, so the week has days before yesterday.
const now = new Date(2026, 10, 25, 15, 0)

describe("saveDateSpan", () => {
  test("names each span as the iOS app does", () => {
    expect(saveDateSpan(new Date(2026, 10, 25, 9, 0), now)).toBe("Today")
    expect(saveDateSpan(new Date(2026, 10, 24, 23, 0), now)).toBe("Yesterday")
    expect(saveDateSpan(new Date(2026, 10, 23, 8, 0), now)).toBe("This Week")
    expect(saveDateSpan(new Date(2026, 10, 18, 8, 0), now)).toBe("Last Week")
    expect(saveDateSpan(new Date(2026, 10, 3, 8, 0), now)).toBe("This Month")
    expect(saveDateSpan(new Date(2026, 9, 3, 8, 0), now)).toBe("Last Month")
    expect(saveDateSpan(new Date(2026, 4, 3, 8, 0), now)).toBe("Earlier")
  })

  test("starts the week on Monday", () => {
    // Sunday 22 November is last week, not this week.
    expect(saveDateSpan(new Date(2026, 10, 22, 12, 0), now)).toBe("Last Week")
  })
})

describe("saveDateGroups", () => {
  test("keeps the saves in their order and cuts where the span changes", () => {
    const items = [
      { id: "a", lastSavedAt: new Date(2026, 10, 25, 14, 0).toISOString() },
      { id: "b", lastSavedAt: new Date(2026, 10, 25, 9, 0).toISOString() },
      { id: "c", lastSavedAt: new Date(2026, 10, 24, 9, 0).toISOString() },
      { id: "d", lastSavedAt: new Date(2026, 4, 1, 9, 0).toISOString() },
    ]

    expect(saveDateGroups(items, now).map((group) => [group.span, group.items.map((item) => item.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      ["Earlier", ["d"]],
    ])
  })
})
