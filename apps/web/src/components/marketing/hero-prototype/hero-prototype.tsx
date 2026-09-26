// PROTOTYPE — throwaway.
// Question: what should the homepage header look like? Three variants on the
// existing `/` route, switchable via `?variant=`, next to the current hero:
//   current  — the pinned card hero that ships today
//   prism    — vgpu.sh: black stage, WebGL beams converging on the mark, channel tabs
//   grid     — payloadcms.com: huge left headline, grid rules, bordered CTA stack,
//              layered product shots bleeding off the right edge
//   switch   — hybrid: the bordered stack IS the channel switcher and drives the visual

import type { ReactNode } from "react"
import { useSearch } from "@tanstack/react-router"

import { Hero } from "../hero/hero"
import { PrototypeSwitcher } from "./prototype-switcher"
import { VariantPrism } from "./variant-prism"
import { VariantGrid } from "./variant-grid"
import { VariantSwitch } from "./variant-switch"
import styles from "./hero-prototype.module.scss"

const variants = [
  { key: "current", name: "Current — pinned card" },
  { key: "prism", name: "Prism — vgpu.sh" },
  { key: "grid", name: "Grid — payloadcms.com" },
  { key: "switch", name: "Switchboard — hybrid" },
] as const

export function HeroPrototype({ children }: { children: ReactNode }) {
  const search = useSearch({ strict: false }) as { variant?: string }
  const current = variants.some((variant) => variant.key === search.variant) ? search.variant! : "current"

  return (
    <>
      {current === "current" ? (
        <Hero>{children}</Hero>
      ) : (
        <>
          {current === "prism" && <VariantPrism />}
          {current === "grid" && <VariantGrid />}
          {current === "switch" && <VariantSwitch />}
          <div className={styles.rest}>{children}</div>
        </>
      )}
      <PrototypeSwitcher variants={variants} current={current} />
    </>
  )
}
