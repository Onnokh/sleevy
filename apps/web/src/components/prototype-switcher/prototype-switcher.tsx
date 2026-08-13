// PROTOTYPE TOOL — not production UI. A floating bar for flipping between design
// variants of one element on a real page. It is deliberately styled unlike
// anything in the product, so nobody mistakes it for the design being judged, and
// it renders in development only.
//
// Delete this together with the variants it switches between.

import { useEffect } from "react"

type Props = {
  readonly variants: ReadonlyArray<{ readonly key: string; readonly name: string }>
  readonly current: string
  readonly onChange: (key: string) => void
}

const bar: React.CSSProperties = {
  position: "fixed",
  bottom: "18px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "6px",
  border: "2px solid #22d3ee",
  borderRadius: "999px",
  background: "#0b1220",
  boxShadow: "0 10px 30px rgb(0 0 0 / 55%)",
  color: "#e0f2fe",
  font: "600 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
}

const arrow: React.CSSProperties = {
  width: "26px",
  height: "26px",
  border: "1px solid #22d3ee",
  borderRadius: "999px",
  background: "transparent",
  color: "#e0f2fe",
  cursor: "pointer",
  font: "inherit",
}

const label: React.CSSProperties = {
  padding: "0 10px",
  whiteSpace: "nowrap",
}

export function PrototypeSwitcher({ variants, current, onChange }: Props) {
  const at = Math.max(0, variants.findIndex((variant) => variant.key === current))
  const step = (by: number) => {
    const next = variants[(at + by + variants.length) % variants.length]
    if (next) onChange(next.key)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.matches("input, textarea, [contenteditable]") ?? false
      if (typing) return
      if (event.key === "ArrowLeft") step(-1)
      if (event.key === "ArrowRight") step(1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // A stray merge cannot show this to a visitor.
  if (!import.meta.env.DEV) return null

  const active = variants[at]

  return (
    <div style={bar} aria-label="Prototype variant switcher">
      <button type="button" style={arrow} onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span style={label}>{active ? `${active.key} — ${active.name}` : "none"}</span>
      <button type="button" style={arrow} onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
    </div>
  )
}
