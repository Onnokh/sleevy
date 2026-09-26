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
      setEdges({
        // A pixel of slack: fractional scroll offsets and zoom both leave a
        // container a hair short of an edge it has visibly reached.
        atStart: element.scrollTop <= 1,
        atEnd: scrollable - element.scrollTop <= 1,
      })
    }

    update()
    element.addEventListener("scroll", update, { passive: true })
    // The article changes under the pane, and the list grows as pages load.
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(element)

    return () => {
      element.removeEventListener("scroll", update)
      resizeObserver.disconnect()
    }
  }, [ref])

  return edges
}
