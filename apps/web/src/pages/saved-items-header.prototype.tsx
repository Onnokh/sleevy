// PROTOTYPE — throwaway. Five ways to draw the timeline marker that won the first
// round, switchable on the real page with ?list=C1|C2|C3|C4|C5.
//
// The question: C read as a continuation of the Reading Activity grid rather than
// a new section. How far should that go — a marker on a rule, a spine down the
// whole list, or markers that keep announcing the month as a reader scrolls?
//
// C3 and C4 reach past the header into the list itself, which is the point of
// them: a timeline that stops at the first card is a heading wearing a costume.
//
// Every measure is rem: the marketing tree scales its root font size with the
// viewport. Styles are inline on purpose — one file to read, one file to delete.

import type { CSSProperties } from "react"

import type { PublicSavedItem, PublicSavedItems } from "../sleevy/public-profile"

export const SAVED_HEADER_VARIANTS = [
  { key: "C1", name: "Marker + rule (round 1)" },
  { key: "C2", name: "Centred divider" },
  { key: "C3", name: "Spine down the list" },
  { key: "C4", name: "Month markers throughout" },
  { key: "C5", name: "Marker + page activity" },
] as const

const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" })
const monthShort = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" })

const HAIRLINE = "rgb(255 255 255 / 10%)"
const ACCENT_BG = "rgb(129 140 248 / 16%)"
const ACCENT_TEXT = "rgb(199 210 254)"

const edges = (items: PublicSavedItems) => {
  const newest = items.savedItems[0]
  const oldest = items.savedItems[items.savedItems.length - 1]
  return newest && oldest
    ? { from: new Date(newest.savedAt), to: new Date(oldest.savedAt) }
    : null
}

const pill: CSSProperties = {
  padding: "0.35rem 0.7rem",
  borderRadius: "999px",
  background: ACCENT_BG,
  color: ACCENT_TEXT,
  fontSize: "0.78rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
}

const faint: CSSProperties = {
  color: "rgb(255 255 255 / 35%)",
  fontSize: "0.78rem",
  whiteSpace: "nowrap",
}

// C1 — what round one showed: the month at the head of the line, the span it
// reaches back to at the end of it.
const C1 = ({ items }: { readonly items: PublicSavedItems }) => {
  const at = edges(items)

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
      <span style={pill}>{at ? monthYear.format(at.from) : "No saves"}</span>
      <span style={{ flex: 1, height: "1px", background: HAIRLINE }} />
      <span style={faint}>{at ? `back to ${monthYear.format(at.to)}` : ""}</span>
    </div>
  )
}

// C2 — the month centred on the rule, the way a chapter break is set. Quieter than
// C1 and symmetrical, so it separates rather than labels.
const C2 = ({ items }: { readonly items: PublicSavedItems }) => {
  const at = edges(items)

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
      <span style={{ flex: 1, height: "1px", background: HAIRLINE }} />
      <span
        style={{
          color: "rgb(255 255 255 / 55%)",
          fontSize: "0.78rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {at ? monthYear.format(at.from) : "No saves"}
      </span>
      <span style={{ flex: 1, height: "1px", background: HAIRLINE }} />
    </div>
  )
}

// C3 — the timeline as a spine. A line runs down the left of the whole list and
// every card hangs off it, so the page reads as one thread from the grid to the
// pager rather than as a heading followed by boxes.
const C3 = ({ items }: { readonly items: PublicSavedItems }) => {
  const at = edges(items)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        marginBottom: "1rem",
        paddingLeft: "0.35rem",
      }}
    >
      <span
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: "999px",
          background: ACCENT_TEXT,
        }}
        aria-hidden="true"
      />
      <span style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 600 }}>
        {at ? monthYear.format(at.from) : "No saves"}
      </span>
      <span style={faint}>{at ? `— ${items.savedItems.length} links` : ""}</span>
    </div>
  )
}

// C5 — the marker, plus this page's saves drawn as bars. It repeats the language of
// the Reading Activity grid at the head of the list, so the two read as the same
// picture at two zoom levels.
const C5 = ({ items }: { readonly items: PublicSavedItems }) => {
  const at = edges(items)
  const byDay = new Map<string, number>()
  for (const item of items.savedItems) {
    const day = item.savedAt.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  const days = [...byDay.entries()].sort(([left], [right]) => left.localeCompare(right))
  const peak = Math.max(1, ...days.map(([, count]) => count))

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={pill}>{at ? monthYear.format(at.from) : "No saves"}</span>
        <span style={{ flex: 1, height: "1px", background: HAIRLINE }} />
        <span style={faint}>{at ? `back to ${monthShort.format(at.to)}` : ""}</span>
      </div>

      {/* One bar per day that carries a save on this page, oldest at the left, so
          it runs the same direction as the grid above. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "0.15rem",
          height: "1.75rem",
          marginTop: "0.75rem",
        }}
        role="img"
        aria-label={`${items.savedItems.length} links on this page across ${days.length} days`}
      >
        {days.map(([day, count]) => (
          <span
            key={day}
            title={`${count} on ${day}`}
            style={{
              flex: 1,
              height: `${Math.max(12, (count / peak) * 100)}%`,
              minWidth: "0.15rem",
              borderRadius: "0.125rem",
              background: `rgb(129 140 248 / ${35 + (count / peak) * 55}%)`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export const SavedItemsHeaderVariant = ({
  variant,
  items,
}: {
  readonly variant: string
  readonly items: PublicSavedItems
}) => {
  if (variant === "C2") return <C2 items={items} />
  if (variant === "C3") return <C3 items={items} />
  // C4 announces each month inside the list, so it puts nothing above it beyond
  // the first marker, which the list itself renders.
  if (variant === "C4") return null
  if (variant === "C5") return <C5 items={items} />
  return <C1 items={items} />
}

// The spine, for C3 only: the list carries the line and indents every card off it.
export const listStyleFor = (variant: string): CSSProperties | undefined =>
  variant === "C3"
    ? { paddingLeft: "1.5rem", marginLeft: "0.35rem", borderLeft: `1px solid ${HAIRLINE}` }
    : undefined

// C4 — a month label wherever the month changes going down the list, so a reader
// who has scrolled past the head still knows where they are.
export const monthChanged = (item: PublicSavedItem, previous: PublicSavedItem | undefined) => {
  if (!previous) return true
  return item.savedAt.slice(0, 7) !== previous.savedAt.slice(0, 7)
}

export const MonthMarker = ({ item }: { readonly item: PublicSavedItem }) => (
  <li
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.85rem",
      margin: "0.75rem 0 0.25rem",
      listStyle: "none",
    }}
  >
    <span
      style={{
        color: "rgb(255 255 255 / 70%)",
        fontSize: "0.78rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {monthYear.format(new Date(item.savedAt))}
    </span>
    <span style={{ flex: 1, height: "1px", background: HAIRLINE }} />
  </li>
)
