import { useCallback } from "react"

import type { SavedItem } from "./saved-items"
import { useReaderViewDisabled } from "./reader-preference"

/**
 * Whether this Saved Item has a Reader View at all.
 *
 * Two things earn one. Readable Content is the obvious one. A post is the
 * other: extraction gets nothing from a client-rendered timeline, but capture
 * already resolved the writer and the message, so a post is its own preview and
 * reads fine without an article.
 */
export const hasReaderView = (item: SavedItem) =>
  item.hasReadableContent || item.type === "post"

/**
 * Where the Open Action leads, for this reader: into the Reader View, or out to
 * the Original URL in the browser.
 *
 * This is the question every caller actually has, and it is not the same as
 * `hasReaderView` — a reader who has turned the Reader View off sends every
 * Saved Item to its Original URL, whether or not one could have been read here.
 */
export function useOpensInReader(): (item: SavedItem) => boolean {
  const disabled = useReaderViewDisabled()
  return useCallback((item: SavedItem) => !disabled && hasReaderView(item), [disabled])
}
