// PROTOTYPE — throwaway. Five heads for the Saved Items list, switchable on the
// real page with ?list=A|B|C|D|E, so each is judged with the real cards under it.
//
// The question: what should sit between the Reading Activity grid and the first
// card? Today it is one uppercase word. What else could earn that line — the shape
// of the list, the slice of time, the mix of what is in it, or nothing at all?
//
// Every measure is rem: the marketing tree scales its root font size with the
// viewport. Styles are inline on purpose — one file to read, one file to delete.

import type { CSSProperties } from "react"

import type { PublicSavedItems } from "../sleevy/public-profile"

export const SAVED_HEADER_VARIANTS = [
  { key: "A", name: "Label + range (current)" },
  { key: "B", name: "Sentence" },
  { key: "C", name: "Timeline marker" },
  { key: "D", name: "Type breakdown" },
  { key: "E", name: "Bare rule" },
] as const

const dayMonth = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" })
const dayMonthOnly = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" })
const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" })

export type ListHeaderProps = {
  readonly items: PublicSavedItems
}

const edges = (items: PublicSavedItems) => {
  const newest = items.savedItems[0]
  const oldest = items.savedItems[items.savedItems.length - 1]
  return newest && oldest
    ? { from: new Date(newest.savedAt), to: new Date(oldest.savedAt) }
    : null
}

const range = (items: PublicSavedItems): string | null => {
  const at = edges(items)
  if (!at) return null
  if (at.from.getTime() === at.to.getTime()) return dayMonth.format(at.from)
  const sameYear = at.from.getUTCFullYear() === at.to.getUTCFullYear()
  return `${(sameYear ? dayMonthOnly : dayMonth).format(at.to)} – ${dayMonth.format(at.from)}`
}

const rule = "1px solid rgb(255 255 255 / 10%)"
const label: CSSProperties = {
  margin: 0,
  color: "rgb(255 255 255 / 55%)",
  fontSize: "0.8rem",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
}

// A — what the page has now: an uppercase label, with the span of dates and the
// page position opposite it.
export const ListA = ({ items }: ListHeaderProps) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "0.35rem 1rem",
      paddingBottom: "0.875rem",
      marginBottom: "1.25rem",
      borderBottom: rule,
    }}
  >
    <h2 style={label}>Recently sleeved</h2>
    <p style={{ margin: 0, color: "rgb(255 255 255 / 40%)", fontSize: "0.8rem" }}>
      {range(items)}
      {items.totalPages > 1 ? ` · page ${items.page} of ${items.totalPages}` : ""}
    </p>
  </div>
)

// B — a sentence instead of a label. It says what the list is in words a person
// would use, and states the ordering rather than leaving it to be inferred.
export const ListB = ({ items }: ListHeaderProps) => {
  const at = edges(items)

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h2
        style={{
          margin: 0,
          color: "rgb(255 255 255 / 88%)",
          fontSize: "1.0625rem",
          fontWeight: 500,
        }}
      >
        {items.page === 1 ? "The newest first" : `Page ${items.page}, still newest first`}
      </h2>
      <p style={{ margin: "0.3rem 0 0", color: "rgb(255 255 255 / 45%)", fontSize: "0.875rem" }}>
        {at
          ? `${items.savedItems.length} links, sleeved between ${monthYear.format(at.to)} and ${
            monthYear.format(at.from)
          }`
          : "Nothing published yet"}
      </p>
    </div>
  )
}

// C — the list as a continuation of the grid above it. A month sits in the margin
// like a marker on a timeline, so the eye reads down a spine rather than across a
// heading.
export const ListC = ({ items }: ListHeaderProps) => {
  const at = edges(items)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <span
        style={{
          padding: "0.35rem 0.7rem",
          borderRadius: "999px",
          background: "rgb(129 140 248 / 16%)",
          color: "rgb(199 210 254)",
          fontSize: "0.78rem",
          fontWeight: 600,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
        }}
      >
        {at ? monthYear.format(at.from) : "No saves"}
      </span>
      <span style={{ flex: 1, height: "1px", background: "rgb(255 255 255 / 10%)" }} />
      <span style={{ color: "rgb(255 255 255 / 35%)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
        {at ? `back to ${monthYear.format(at.to)}` : ""}
      </span>
    </div>
  )
}

// D — the mix, not the dates. Counts per Type say what kind of reader this is
// before a visitor scrolls, which is the thing the cards only reveal one at a
// time.
export const ListD = ({ items }: ListHeaderProps) => {
  const counts = new Map<string, number>()
  for (const item of items.savedItems) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  }
  const names: Record<string, string> = {
    post: "posts",
    article: "articles",
    repository: "repos",
    video: "videos",
    website: "pages",
  }
  const ordered = [...counts.entries()].sort((left, right) => right[1] - left[1])

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.5rem 1.25rem",
        paddingBottom: "0.875rem",
        marginBottom: "1.25rem",
        borderBottom: rule,
      }}
    >
      <h2 style={{ ...label, marginRight: "auto" }}>On this page</h2>
      {ordered.map(([type, count]) => (
        <span
          key={type}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "0.3rem",
            color: "rgb(255 255 255 / 45%)",
            fontSize: "0.8rem",
          }}
        >
          <b style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 600 }}>{count}</b>
          {names[type] ?? type}
        </span>
      ))}
    </div>
  )
}

// E — nothing but a rule. The identity header already says how many links there
// are, and every card states its own date, so this argues the line is a line the
// page does not need.
export const ListE = () => (
  <div style={{ marginBottom: "1.5rem", borderTop: rule }} />
)

export const SavedItemsHeaderVariant = ({
  variant,
  items,
}: ListHeaderProps & { readonly variant: string }) => {
  if (variant === "B") return <ListB items={items} />
  if (variant === "C") return <ListC items={items} />
  if (variant === "D") return <ListD items={items} />
  if (variant === "E") return <ListE />
  return <ListA items={items} />
}
