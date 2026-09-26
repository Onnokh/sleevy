// PROTOTYPE — throwaway. Look "quiet": solid dark cards and no shader, so the
// hero stays the only glass on the page. Editorial, left-aligned copy with the
// app icon inline, the button inside the card, and the screenshot bleeding off
// the bottom edge.

import clsx from "clsx"

import { highlights } from "./highlight-data"
import styles from "./variant-quiet.module.scss"

export function VariantQuiet() {
  return (
    <section className={styles.section} aria-label="Sleevy on every surface">
      <div className={styles.grid}>
        {highlights.map((item) => (
          <article key={item.key} className={clsx(styles.card, styles[item.key])}>
            <div className={styles.eyebrow}>
              <img src={item.icon.src} alt={item.icon.alt} width={82} height={82} loading="lazy" />
              {item.eyebrow}
            </div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <a className={styles.cta} href={item.cta.href}>
              {item.cta.label}
              <span aria-hidden="true">→</span>
            </a>
            <img
              className={styles.shot}
              src={item.shot.src}
              alt={item.shot.alt}
              width={item.shot.width}
              height={item.shot.height}
              loading="lazy"
            />
          </article>
        ))}
      </div>
    </section>
  )
}
