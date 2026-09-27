import { type RefObject, useEffect, useState } from "react"

import type { ArticleOutline } from "../sleevy/article-outline"

/// How far down the reading pane a heading travels before the section it opens
/// becomes the one being read. A section is claimed as its heading reaches the
/// top of the pane rather than as it leaves the pane: waiting for it to leave
/// keeps the *previous* section marked for the whole first screen of the new
/// one, which the reader sees as the rail lagging a section behind them.
export const READING_LINE = 96

/// Which entry of an Article Outline is being read, from where the headings
/// sit and where the pane has been scrolled to.
///
/// Pure, and written in four numbers every platform already has. The obvious
/// implementation on the web is an IntersectionObserver, and SwiftUI has no
/// such thing — a rule written against one would not have survived the
/// crossing, while this one is the same arithmetic against a scroll offset
/// wherever it is rebuilt.
///
/// The opening of an article — its title, its byline, the paragraphs before
/// the first heading — belongs to no section, and the rail marks the first one
/// there anyway. A rail that starts with nothing lit reads as not yet working,
/// and the reader is on their way into that first section rather than anywhere
/// else. Only an empty outline has no answer, and an empty outline draws no
/// rail to answer for.
export function activeOutlineIndex(
  tops: readonly number[],
  scrollTop: number,
  viewportHeight: number,
  contentHeight: number,
): number {
  if (tops.length === 0) return -1

  // The last section of an article is usually shorter than the reading line is
  // deep, so its heading never travels far enough to claim its mark and the
  // rail stops one short however far the reader scrolls. Reaching the end of
  // the article is reaching its last section, whatever the arithmetic says.
  if (contentHeight - viewportHeight - scrollTop <= 1) return tops.length - 1

  let active = 0
  tops.forEach((top, index) => {
    if (top - scrollTop <= READING_LINE) active = index
  })

  return active
}

/// The Article Outline entry being read, as an index into the outline, kept in
/// step with a scrolling pane. The first entry until the reader has passed it,
/// and -1 only for an article with no outline at all.
export function useOutlinePosition(
  scrollParent: RefObject<HTMLElement | null> | undefined,
  outline: ArticleOutline,
): number {
  // The first section, before anything has been measured. The rail is drawn on
  // the same render that mounts the article, and starting at -1 gave it one
  // frame with no mark lit.
  const [active, setActive] = useState(0)

  useEffect(() => {
    const parent = scrollParent?.current
    if (!parent || outline.length === 0) {
      setActive(-1)
      return
    }

    const update = () => {
      const parentTop = parent.getBoundingClientRect().top

      const tops = outline.map((entry) => {
        const heading = document.getElementById(entry.id)
        // A heading the renderer could not be matched to is not a place the
        // reader can be, so it never claims the mark.
        return heading
          ? heading.getBoundingClientRect().top - parentTop + parent.scrollTop
          : Number.POSITIVE_INFINITY
      })

      const next = activeOutlineIndex(
        tops,
        parent.scrollTop,
        parent.clientHeight,
        parent.scrollHeight,
      )

      // Only on a real change. A scroll event fires for every frame of every
      // gesture, and answering each one with a render rebuilt the whole
      // article — which is what made its images flicker before ADR 0021's
      // reader was holding its element types still.
      setActive((current) => (current === next ? current : next))
    }

    update()
    parent.addEventListener("scroll", update, { passive: true })

    // The offsets move while the article settles: Markdown carries no width or
    // height, so every image arrives with nothing reserved for it and pushes
    // every heading below it down. Watching the pane alone reports none of
    // that — its own box never changes while the content grows inside it — so
    // the content is watched as well.
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(parent)
    for (const child of parent.children) resizeObserver.observe(child)

    return () => {
      parent.removeEventListener("scroll", update)
      resizeObserver.disconnect()
    }
  }, [outline, scrollParent])

  return active
}
