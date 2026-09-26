// PROTOTYPE — throwaway. Look "window": the two cards are panes onto ONE wall
// of the hero's glass. Both canvases take the grid as their wall, so the ribs
// and the light run straight on from one card into the next across the gap.
// The ribs keep the hero's size; the light drifts slowly and ignores the pointer.

import { useRef } from "react"
import clsx from "clsx"

import { GlassBackground } from "../glass-background/glass-background"
import { highlights } from "./highlight-data"
import styles from "./variant-window.module.scss"

export function VariantWindow() {
  const wallRef = useRef<HTMLDivElement>(null)

  return (
    <section className={styles.section} aria-label="Sleevy on every surface">
      <div className={styles.grid} ref={wallRef}>
        {highlights.map((item) => (
          <article key={item.key} className={clsx(styles.card, styles[item.key])}>
            <GlassBackground
              wallRef={wallRef}
              glassHeight={56.25}
              tone={0.75}
              roamingLight={0.2}
              speed={0.5}
              interactive={false}
              calm={[0.45, 0.8, 0.2]}
              seed={3}
            />
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
