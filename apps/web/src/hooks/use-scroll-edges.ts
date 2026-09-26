import { useEffect, useState, type RefObject } from "react"

type ScrollEdges = {
  /** Nothing has scrolled past the top edge yet. */
  readonly atStart: boolean
  /** Nothing is left below the bottom edge. */
  readonly atEnd: boolean
}

/**
 * Whether a scroll container is resting against either of its edges.
 *
 * An edge fade stands for content continuing past the edge, so it has nothing
 * to say when there is none: at the top of a list the first row would be
 * dimmed for no reason. Content that does not overflow reports both edges, and
 * both fades stay away.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ atStart: true, atEnd: true })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const scrollable = element.scrollHeight - element.clientHeight
      // A pixel of slack: fractional scroll offsets and zoom both leave a
      // container a hair short of an edge it has visibly reached.
      const next = {
        atStart: element.scrollTop <= 1,
        atEnd: scrollable - element.scrollTop <= 1,
      }
      // Only on a real change. A scroll event fires for every frame of every
      // gesture, and a fresh object each time re-rendered the whole reader —
      // article and all — for an answer that had not moved.
      setEdges((current) =>
        current.atStart === next.atStart && current.atEnd === next.atEnd ? current : next,
      )
    }

    update()
    element.addEventListener("scroll", update, { passive: true })

    // The container's own box is all a ResizeObserver reports for it, and that
    // box does not move while the content grows inside it — these panes are a
    // fixed height. So the content is watched as well. Without this the end of
    // an article could travel away from a reader already resting on it, with
    // no scroll event to notice: the fade stayed hidden over content that had
    // appeared below it and then snapped back on the next flick of the wheel.
    // An image is the usual cause, reserving nothing until it has loaded.
    const resizeObserver = new ResizeObserver(update)
    const observeContent = () => {
      resizeObserver.observe(element)
      for (const child of element.children) resizeObserver.observe(child)
    }
    observeContent()

    // The list grows by gaining rows rather than by any one row changing size,
    // so new children are picked up as they arrive.
    const mutationObserver = new MutationObserver(() => {
      observeContent()
      update()
    })
    mutationObserver.observe(element, { childList: true })

    return () => {
      element.removeEventListener("scroll", update)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [ref])

  return edges
}
