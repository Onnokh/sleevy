import { useEffect } from "react"

/**
 * Sets `--title-bearing` on a heading: the space between its box and the ink
 * of its first letter. A "D" has more of it than an "A", so a mark set at a
 * fixed distance from the box looks closer to some titles than to others.
 * Subtract the bearing and the distance is the same to every first letter.
 */
export function useTitleBearing(element: HTMLElement | null, text: string) {
  useEffect(() => {
    if (!element) return
    let cancelled = false

    const measure = () => {
      if (cancelled) return
      const context = document.createElement("canvas").getContext("2d")
      if (!context) return
      const style = getComputedStyle(element)
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      context.letterSpacing = style.letterSpacing
      // Positive to the left of the origin, so the ink starts at minus it.
      const bearing = -context.measureText(text.charAt(0)).actualBoundingBoxLeft
      element.style.setProperty("--title-bearing", `${bearing}px`)
    }

    // The fallback font has other bearings: measure once the real one is in.
    void document.fonts.ready.then(measure)
    return () => {
      cancelled = true
    }
  }, [element, text])
}
