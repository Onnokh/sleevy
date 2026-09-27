import type { CSSProperties } from "react"

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
  if (outline.length === 0) return null

  return (
    <div className={styles.anchor}>
      <nav className={styles.rail} aria-label="Article sections">
        <ol className={styles.marks}>
          {outline.map((entry, index) => (
            <li className={styles.item} key={entry.id}>
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
                onClick={() => onSelect(entry)}
              >
                <span className={styles.tick} />
              </button>

              <span className={styles.card} aria-hidden="true">
                <span className={styles.cardTitle}>{entry.title}</span>
                {entry.excerpt ? (
                  <span className={styles.cardExcerpt}>{entry.excerpt}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}
