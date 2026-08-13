// PROTOTYPE — throwaway. Four headers for the top of a Public Profile, switchable
// on the real page with ?variant=A|B|C|D, so each one is judged against the real
// activity grid and the real cards under it rather than in a vacuum.
//
// The question: what should the top of a Public Profile show, given a Handle, a
// count of published Saved Items, and a join date — and does calling it a sleeve
// carry the page?
//
// Every measure is rem, because the marketing tree scales its root font size with
// the viewport. Styles are inline here on purpose: a prototype should be one file
// to read and one file to delete.

import type { CSSProperties } from "react"

const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" })
const shortMonthYear = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" })

export type HeaderProps = {
  readonly handle: string
  readonly savedItemCount: number
  readonly joinedAt: string
}

export const PROFILE_HEADER_VARIANTS = [
  { key: "A", name: "Sleeve nameplate" },
  { key: "B", name: "Stat band" },
  { key: "C", name: "Sleeve object" },
  { key: "D", name: "Shipped (current)" },
] as const

const sleeves = (count: number) => `${count} ${count === 1 ? "sleeve" : "sleeves"}`

// A — the naming idea, carried by one line. The Handle is possessive and the word
// "sleeve" does the work; the numbers sit under it as quiet support.
export const VariantA = ({ handle, savedItemCount, joinedAt }: HeaderProps) => (
  <header style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
    <h1
      style={{
        margin: 0,
        fontSize: "clamp(2.25rem, 5vw, 3.25rem)",
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      @{handle}<span style={{ color: "rgb(255 255 255 / 45%)" }}>&rsquo;s sleeve</span>
    </h1>
    <p style={{ margin: 0, color: "rgb(255 255 255 / 60%)", fontSize: "0.95rem" }}>
      {sleeves(savedItemCount)} · collecting since {monthYear.format(new Date(joinedAt))}
    </p>
  </header>
)

// B — the numbers are the header. The Handle names the page and three measured
// blocks sit beside it, the way a dashboard states a total.
const statBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.15rem",
  paddingLeft: "1.25rem",
  borderLeft: "1px solid rgb(255 255 255 / 12%)",
}

const statValue: CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 600,
  lineHeight: 1.1,
  letterSpacing: "-0.01em",
}

const statLabel: CSSProperties = {
  color: "rgb(255 255 255 / 45%)",
  fontSize: "0.75rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
}

export const VariantB = ({ handle, savedItemCount, joinedAt }: HeaderProps) => (
  <header
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "1.5rem 2rem",
      paddingBottom: "1.5rem",
      borderBottom: "1px solid rgb(255 255 255 / 10%)",
    }}
  >
    <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 2.75rem)", lineHeight: 1 }}>
      @{handle}
    </h1>
    <div style={{ display: "flex", gap: "2rem" }}>
      <div style={statBlock}>
        <span style={statValue}>{savedItemCount}</span>
        <span style={statLabel}>Sleeves</span>
      </div>
      <div style={statBlock}>
        <span style={statValue}>{shortMonthYear.format(new Date(joinedAt))}</span>
        <span style={statLabel}>Member since</span>
      </div>
    </div>
  </header>
)

// C — the sleeve as an object. A panel with a spine down its left edge and a
// monogram tile, so the page opens with something that looks like a thing you own
// rather than a line of text.
export const VariantC = ({ handle, savedItemCount, joinedAt }: HeaderProps) => (
  <header
    style={{
      display: "flex",
      alignItems: "stretch",
      overflow: "hidden",
      borderRadius: "1rem",
      border: "1px solid rgb(255 255 255 / 10%)",
      background:
        "linear-gradient(135deg, rgb(129 140 248 / 14%) 0%, rgb(255 255 255 / 3%) 45%, rgb(255 255 255 / 2%) 100%)",
    }}
  >
    {/* The spine. */}
    <div
      style={{
        width: "0.5rem",
        background: "linear-gradient(rgb(129 140 248 / 90%), rgb(129 140 248 / 30%))",
      }}
      aria-hidden="true"
    />
    <div
      style={{
        display: "flex",
        flex: 1,
        flexWrap: "wrap",
        alignItems: "center",
        gap: "1.25rem",
        padding: "1.75rem",
      }}
    >
      <div
        style={{
          display: "grid",
          placeItems: "center",
          width: "3.5rem",
          height: "3.5rem",
          borderRadius: "0.75rem",
          background: "rgb(255 255 255 / 8%)",
          fontSize: "1.5rem",
          fontWeight: 600,
        }}
        aria-hidden="true"
      >
        {handle.charAt(0).toUpperCase()}
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "0.3rem" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", lineHeight: 1 }}>
          @{handle}&rsquo;s sleeve
        </h1>
        <p style={{ margin: 0, color: "rgb(255 255 255 / 55%)", fontSize: "0.9rem" }}>
          {sleeves(savedItemCount)} · since {monthYear.format(new Date(joinedAt))}
        </p>
      </div>
    </div>
  </header>
)

// D — what the page ships today, kept in the switcher so a variant is compared
// against the thing it would replace rather than against memory.
export const VariantD = ({ handle, savedItemCount, joinedAt }: HeaderProps) => (
  <header
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: "0.75rem 1.25rem",
    }}
  >
    <h1
      style={{
        margin: 0,
        fontSize: "clamp(2.25rem, 5vw, 3.25rem)",
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      @{handle}
    </h1>
    <p style={{ margin: 0, color: "rgb(255 255 255 / 60%)", fontSize: "0.95rem" }}>
      {savedItemCount} public {savedItemCount === 1 ? "save" : "saves"} · joined{" "}
      {monthYear.format(new Date(joinedAt))}
    </p>
  </header>
)

export const ProfileHeaderVariant = ({
  variant,
  ...props
}: HeaderProps & { readonly variant: string }) => {
  if (variant === "A") return <VariantA {...props} />
  if (variant === "B") return <VariantB {...props} />
  if (variant === "C") return <VariantC {...props} />
  return <VariantD {...props} />
}
