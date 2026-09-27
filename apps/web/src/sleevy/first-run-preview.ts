import { useMemo, useSyncExternalStore } from "react"

import type { SavedItem } from "./saved-items"

/**
 * A development-only way to try the first run with an Account that is not new.
 *
 * `/inbox?preview=first-run` shows the Inbox as if the Account had saved
 * nothing yet, and treats the Account as new, so the First-Run Inbox, the
 * Enrichment Reveal and the Getting Started Card can be walked through against
 * the local API. Saves are real. The preview shows only the Saved Items saved
 * since it began, from any Capture Channel, so a save from an iPhone build
 * pointed at the local API checks its step off too.
 *
 * `&ai=sample` fills in a sample Preview Summary and Tag when Enrichment ends
 * without them, which is every time on a local API with AI turned off.
 *
 * It lasts for the tab, and it does not exist in a production build.
 */
export type FirstRunPreview = {
  readonly startedAt: number
  readonly sampleAi: boolean
}

const STORAGE_KEY = "sleeve:firstRunPreview"

const SAMPLE_SUMMARY = "Sample summary. With AI turned on, Sleevy writes one line here on what the page says."

const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

const readRaw = (): string | null => {
  if (!import.meta.env.DEV || typeof sessionStorage === "undefined") return null
  return sessionStorage.getItem(STORAGE_KEY)
}

const parse = (raw: string | null): FirstRunPreview | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as FirstRunPreview
  } catch {
    return null
  }
}

export const readFirstRunPreview = () => parse(readRaw())

/// Starts a preview when the address asks for one and none is running, then
/// takes the request out of the address, so a reload carries on with the same
/// preview instead of starting it again.
const startFromAddress = () => {
  if (!import.meta.env.DEV || typeof window === "undefined") return
  const params = new URLSearchParams(window.location.search)
  if (params.get("preview") !== "first-run") return

  if (!readRaw()) {
    const preview: FirstRunPreview = { startedAt: Date.now(), sampleAi: params.get("ai") === "sample" }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview))
    // Each preview starts with a fresh Getting Started Card.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sleeve:gettingStarted:") && key.endsWith(":preview")) localStorage.removeItem(key)
    }
  }
  params.delete("preview")
  params.delete("ai")
  const query = params.toString()
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
}

startFromAddress()

export function exitFirstRunPreview() {
  sessionStorage.removeItem(STORAGE_KEY)
  notify()
}

export function useFirstRunPreview(): FirstRunPreview | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null)
  return useMemo(() => parse(raw), [raw])
}

/// The Saved Items the previewed Inbox holds: only those saved since the
/// preview began, with the sample summary filled in when asked for.
export function previewSavedItems(items: readonly SavedItem[], preview: FirstRunPreview): readonly SavedItem[] {
  return items
    .filter((item) => Date.parse(item.lastSavedAt) >= preview.startedAt)
    .map((item) =>
      preview.sampleAi && item.enrichmentStatus === "enriched" && !item.previewSummary && item.tags.length === 0
        ? { ...item, previewSummary: SAMPLE_SUMMARY, tags: ["tools"] }
        : item,
    )
}
