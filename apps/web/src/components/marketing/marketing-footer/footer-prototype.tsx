// PROTOTYPE — throwaway.
// Question: how does the footer tie in with the new homepage (the glass hero,
// the quiet cards, the agent demo)? Looks on every marketing page, switchable
// via `?footer=` or the ← → keys:
//   bookend — a band of the hero's glass with a closing line and the hero's buttons
//   mark    — a quiet link grid and a huge Sleevy mark filled with the live glass
//   quiet   — no shader: the page's type system and a bottom bar with the buttons
//   current — the purple mesh footer (baseline)

import { useSearch } from "@tanstack/react-router"

import { MarketingFooter } from "./marketing-footer"
import { PrototypeSwitcher } from "./prototype-switcher"
import { VariantBookend } from "./variant-bookend"
import { VariantMark } from "./variant-mark"
import { VariantQuiet } from "./variant-quiet"

const variants = [
  { key: "bookend", name: "Bookend — glass band + CTA" },
  { key: "mark", name: "Mark — glass-filled logo" },
  { key: "quiet", name: "Quiet — type and hairlines" },
  { key: "current", name: "Current — purple mesh" },
] as const

export function FooterPrototype() {
  const search = useSearch({ strict: false }) as { footer?: string }
  const current = variants.some((variant) => variant.key === search.footer) ? search.footer! : "bookend"

  return (
    <>
      {current === "bookend" && <VariantBookend />}
      {current === "mark" && <VariantMark />}
      {current === "quiet" && <VariantQuiet />}
      {current === "current" && <MarketingFooter />}
      <PrototypeSwitcher variants={variants} current={current} />
    </>
  )
}
