// PROTOTYPE — throwaway. Look "split": no cards at all. Two editorial rows in
// the container, copy on one side and the screenshot on the other (the second
// row mirrored), divided by thin rules — the hero's left-aligned voice carried
// down the page. The screenshot sits in the hero's glass frame over a still,
// soft pool of its blue light.

import clsx from "clsx"

import { highlights } from "./highlight-data"
import styles from "./variant-split.module.scss"

export function VariantSplit() {
  return (
    <section className={styles.section} aria-label="Sleevy on every surface">
      <div className={styles.rows}>
        {highlights.map((item) => (
          <article key={item.key} className={clsx(styles.row, styles[item.key])}>
            <div className={styles.copy}>
              <div className={styles.eyebrow}>
                <img src={item.icon.src} alt={item.icon.alt} width={82} height={82} loading="lazy" />
                {item.eyebrow}
              </div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <a className={styles.cta} href={item.cta.href}>
                <img src={item.cta.glyph} alt="" width={96} height={96} loading="lazy" />
                {item.cta.label}
              </a>
            </div>
            <div className={styles.media}>
              <div className={styles.frame}>
                <img
                  src={item.shot.src}
                  alt={item.shot.alt}
                  width={item.shot.width}
                  height={item.shot.height}
                  loading="lazy"
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
