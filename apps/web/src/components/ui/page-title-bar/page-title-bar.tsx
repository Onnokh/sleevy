import { useEffect, useState } from "react"

import styles from "./page-title-bar.module.scss"

/// The title band, not the full height of the fade below it. The observer
/// needs it in pixels: the large title counts as gone once it has passed under
/// the small one, not once it has left the viewport, or the swap arrives late.
const TITLE_BAND = 52

type PageTitleBarProps = {
  readonly title: string
  /// The large heading this bar stands in for — the element itself, not a ref
  /// to it. A ref object keeps one identity for the life of the page, so an
  /// observer created against it never learns that the heading it watches has
  /// been replaced. The Reader View replaces it on every article, and the bar
  /// was left observing a node that had already left the document: detached,
  /// it never intersects, so the bar stayed up over a page with nothing
  /// scrolled. Callers hold the heading in state and pass the setter as its
  /// `ref`, so this changes identity whenever the heading does.
  readonly watch?: HTMLElement | null
  /// Whether the bar is shown, for a column whose heading is too small and too
  /// near the top edge for the band above to read it: a label sitting inside
  /// TITLE_BAND is reported as already gone, so the bar would never be hidden.
  /// The caller says so directly instead — the Reader View's article list uses
  /// its own scroll position.
  readonly show?: boolean
}

/// The small centred title that takes over once a page's large title has
/// scrolled away, the way a navigation bar does on iOS.
///
/// It is decorative by construction: the page keeps exactly one `h1`, and this
/// is a second rendering of the same words, so it stays out of the
/// accessibility tree entirely.
export function PageTitleBar({ title, watch, show }: PageTitleBarProps) {
  const [observed, setObserved] = useState(false)
  const [observedTitle, setObservedTitle] = useState(title)

  // Cleared as the title changes, during the render that changes it — not in an
  // effect afterwards. An effect runs once the browser has already painted, so
  // the arriving title got a frame pinned over a page sitting at its own top,
  // which is the flash. Adjusting the state here means it never gets that
  // frame: the bar is empty before the new title is anywhere on screen, and
  // comes back only when the new heading has really scrolled away.
  if (observedTitle !== title) {
    setObservedTitle(title)
    setObserved(false)
  }

  const collapsed = show ?? observed

  useEffect(() => {
    if (show !== undefined || !watch) return

    const observer = new IntersectionObserver(
      ([entry]) => setObserved(!(entry?.isIntersecting ?? true)),
      { rootMargin: `-${TITLE_BAND}px 0px 0px 0px` },
    )
    observer.observe(watch)

    return () => observer.disconnect()
  }, [show, watch])

  return (
    // Keyed on the title, so a new one arrives as a new element rather than
    // inheriting the outgoing one's opacity transition. Without the key the bar
    // would fade the incoming words out over 180ms instead of never showing
    // them, which reads as the same flash by a slower route.
    <div
      key={title}
      className={styles.bar}
      data-collapsed={collapsed || undefined}
      aria-hidden="true"
    >
      <div className={styles.surface}>
        <span className={styles.title}>{title}</span>
      </div>
    </div>
  )
}
