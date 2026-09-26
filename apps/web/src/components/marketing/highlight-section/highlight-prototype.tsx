// PROTOTYPE — throwaway.
// Question: what should the two highlight blocks (Native Share, Raycast) look
// like under the new glass hero? Four looks on the existing `/` route,
// switchable via `?cards=` or the ← → keys:
//   current — centred cards on a zoomed-in hint of the glass, straddling icons and buttons
//   quiet   — solid dark cards, no shader; left-aligned copy, button inside
//   window  — both cards are panes onto one continuous wall of the hero's glass
//   split   — no cards: two mirrored editorial rows divided by thin rules

import { useSearch } from "@tanstack/react-router"

import { HighlightSection } from "./highlight-section"
import { PrototypeSwitcher } from "./prototype-switcher"
import { VariantQuiet } from "./variant-quiet"
import { VariantSplit } from "./variant-split"
import { VariantWindow } from "./variant-window"

const variants = [
  { key: "current", name: "Current — glass hint" },
  { key: "quiet", name: "Quiet — solid cards" },
  { key: "window", name: "Window — one glass wall" },
  { key: "split", name: "Split — editorial rows" },
] as const

export function HighlightPrototype() {
  const search = useSearch({ strict: false }) as { cards?: string }
  const current = variants.some((variant) => variant.key === search.cards) ? search.cards! : "current"

  return (
    <>
      {current === "current" && <HighlightSection />}
      {current === "quiet" && <VariantQuiet />}
      {current === "window" && <VariantWindow />}
      {current === "split" && <VariantSplit />}
      <PrototypeSwitcher variants={variants} current={current} />
    </>
  )
}
