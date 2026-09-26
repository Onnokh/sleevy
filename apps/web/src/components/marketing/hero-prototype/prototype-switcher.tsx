// PROTOTYPE — throwaway. Floating bar that cycles the ?variant= search param.

import { useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"

import styles from "./prototype-switcher.module.scss"

type Variant = { readonly key: string; readonly name: string }

export function PrototypeSwitcher({ variants, current }: { variants: readonly Variant[]; current: string }) {
  const navigate = useNavigate()
  const index = Math.max(0, variants.findIndex((variant) => variant.key === current))

  const go = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length]
    void navigate({
      to: ".",
      // The home route declares no search schema; the prototype param rides untyped.
      search: ((previous: Record<string, unknown>) => ({ ...previous, variant: next.key })) as never,
      replace: true,
      resetScroll: false,
    })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      const target = event.target as HTMLElement | null
      // Tab lists inside the variants use the arrow keys themselves.
      if (target?.closest("input, textarea, [contenteditable], [role=tablist]")) return
      go(event.key === "ArrowLeft" ? -1 : 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!import.meta.env.DEV) return null

  const variant = variants[index]
  return (
    <div className={styles.bar} role="toolbar" aria-label="Prototype variant">
      <button type="button" className={styles.arrow} onClick={() => go(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className={styles.label}>
        <b>{index + 1}/{variants.length}</b> {variant.name}
      </span>
      <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label="Next variant">
        →
      </button>
    </div>
  )
}
