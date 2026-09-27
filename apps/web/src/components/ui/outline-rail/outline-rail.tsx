import { type CSSProperties, useState } from "react"

import type { ArticleOutline, OutlineEntry } from "../../../sleevy/article-outline"
import styles from "./outline-rail.module.scss"

/// How wide a mark is drawn, as a fraction of a full one, by how many sections
/// it sits from the one being read.
///
/// The taper is what makes the rail readable without counting. Every mark the
/// same width is a ruler: the reader can see how many sections there are and
/// not where they are in them. Tapered, the eye finds the place before it
/// finds the marks.
///
/// A table rather than a curve, so the rail is redrawn from these four numbers
/// wherever it is rebuilt rather than from an easing function that has to be
/// ported exactly.
export const MARK_SCALE = [1, 0.74, 0.58, 0.46] as const

/// The width of one mark, from its distance to the section being read.
export const markScale = (distance: number): number =>
  MARK_SCALE[Math.min(distance, MARK_SCALE.length - 1)] ?? 1

/// Nothing under the pointer and nothing focused.
const NONE = -1

type OutlineRailProps = {
  readonly outline: ArticleOutline
  /// The section being read, as an index into the outline. The first section
  /// until the reader has passed it, so a mark is always lit.
  readonly activeIndex: number
  readonly onSelect: (entry: OutlineEntry) => void
}

/// The Article Outline as a column of marks beside the article: where the
/// sections are, which one is being read, and a way into any of them.
///
/// It is navigation, not decoration, so it is a real landmark with a real
/// button per section. The card is a second rendering of words the button
/// already carries as its name, which is why it stays out of the
/// accessibility tree — a screen reader hears the section once.
export function OutlineRail({ outline, activeIndex, onSelect }: OutlineRailProps) {
  // Which mark the pointer or the keyboard is on.
  const [pointed, setPointed] = useState(NONE)
  // Where the card is drawn. It keeps the last mark it was on while it fades
  // away, so it dissolves where the reader left it instead of sliding back up
  // the rail on its way out.
  const [restingAt, setRestingAt] = useState(0)
  // Whether the card should travel to where it is going, rather than be put
  // there. It travels only between two marks it is already standing on:
  // arriving from nothing, the position and the fade would otherwise begin
  // together and the card crossed the whole rail on its way in.
  const [travelling, setTravelling] = useState(false)

  const pointAt = (index: number) => {
    setTravelling(pointed !== NONE)
    setPointed(index)
    setRestingAt(index)
  }

  const release = () => {
    setPointed(NONE)
    setTravelling(false)
  }

  if (outline.length === 0) return null

  const resting = outline[restingAt] ?? outline[0]!
  // The sections either side, where there is one. At the ends of an article
  // there is not, and that neighbour keeps its place in the deck without being
  // drawn — see .peekEmpty.
  const before = outline[restingAt - 1]
  const after = outline[restingAt + 1]

  return (
    <div className={styles.anchor}>
      <nav
        className={styles.rail}
        aria-label="Article sections"
        style={{ "--pointed-index": restingAt } as CSSProperties}
      >
        {/* The rail lets go of the card, not each mark. Between two marks there
            is a gap, and focus moving from one to the next leaves the first —
            a card released by either would blink out and back on its way from
            one section to another. */}
        <ol
          className={styles.marks}
          onPointerLeave={release}
          onBlur={(event) => {
            // Focus moving along the rail is not focus leaving it.
            if (!event.currentTarget.contains(event.relatedTarget)) release()
          }}
        >
          {outline.map((entry, index) => (
            <li
              className={styles.item}
              key={entry.id}
              onPointerEnter={() => pointAt(index)}
            >
              <button
                type="button"
                className={styles.mark}
                style={
                  {
                    "--mark-scale": markScale(Math.abs(index - activeIndex)),
                  } as CSSProperties
                }
                data-current={index === activeIndex || undefined}
                aria-current={index === activeIndex ? "true" : undefined}
                aria-label={entry.title}
                onFocus={() => pointAt(index)}
                onClick={() => onSelect(entry)}
              >
                <span className={styles.tick} />
              </button>
            </li>
          ))}
        </ol>

        {/* One deck for the whole rail, carried to the mark under the pointer,
            rather than one card per mark shown and hidden in turn. Fifteen
            cards taking their own turns read as fifteen separate events; one
            deck that travels reads as the reader moving along the article,
            which is what they are doing.

            The sections either side sit half-hidden behind the one in front.
            A reader looking for a section is looking for a place in an order,
            and a lone card says only where the pointer is — not which way the
            thing they want lies. Named, so the next step is a step and not a
            guess. */}
        <span
          className={styles.deck}
          data-shown={pointed !== NONE || undefined}
          data-travelling={travelling || undefined}
          aria-hidden="true"
        >
          <span
            className={`${styles.peek} ${styles.peekBefore}`}
            data-empty={!before || undefined}
          >
            <span className={styles.peekLabel}>{before?.title}</span>
          </span>

          <span className={styles.card}>
            <span className={styles.cardTitle}>{resting.title}</span>
            {resting.excerpt ? (
              <span className={styles.cardExcerpt}>{resting.excerpt}</span>
            ) : null}
          </span>

          <span
            className={`${styles.peek} ${styles.peekAfter}`}
            data-empty={!after || undefined}
          >
            <span className={styles.peekLabel}>{after?.title}</span>
          </span>
        </span>
      </nav>
    </div>
  )
}
