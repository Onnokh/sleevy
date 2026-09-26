import { Link } from "@tanstack/react-router"
import clsx from "clsx"

import { GlassBackground } from "../glass-background/glass-background"
import { appStoreUrl, raycastDeeplink } from "../store-links"
import styles from "./highlight-section.module.scss"

/* Progressive blur band at the frame's bottom edge (see .fade in the module). */
function BlurFade() {
  return (
    <div className={styles.fade} aria-hidden="true">
      <div className={styles.fadeLayer} />
      <div className={styles.fadeLayer} />
      <div className={styles.fadeLayer} />
      <div className={styles.fadeLayer} />
      <div className={styles.fadeLayer} />
    </div>
  )
}

/* A hint of the hero's glass, not a copy: the glass zoomed in five times past
   the hero's scale (its 900px height at 1440), so a card holds a few very
   broad ribs, over the hero's light at a bit more than the card's height.
   Slow, dim, and still under the pointer, with a dark top for the title and
   copy; each card gets its own seed. */
const cardGlass = {
  glassHeight: 56.25 * 5,
  lightHeight: 54,
  tone: 0.5,
  roamingLight: 0.1,
  speed: 0.4,
  interactive: false,
  calm: [0.5, 0.85, 0.25],
} as const

export function HighlightSection() {
  return (
    <section className={styles.section} aria-label="Sleevy on every surface">
      <div className={styles.grid}>
        <article className={styles.card}>
          <div className={clsx(styles.frame, styles.frameShare)}>
            <GlassBackground {...cardGlass} seed={1} />
            <h3>Native Share</h3>
            <p>Hit share in any app, pick Sleevy, and the link is saved. Nothing to copy or paste.</p>
            <img
              className={clsx(styles.shot, styles.shotShare)}
              src="/share-sheet-750.webp"
              alt="iOS share sheet with Sleevy selected"
              width={750}
              height={906}
              loading="lazy"
            />
            <BlurFade />
          </div>
          <img className={styles.icon} src="/ios26-82.webp" alt="Sleevy iPhone app icon" width={82} height={82} loading="lazy" />
          <a className={styles.cta} href={appStoreUrl}>
            <img src="/appstore-glyph-96.webp" alt="" width={96} height={96} loading="lazy" />
            Install on your iPhone
          </a>
        </article>
        <article className={styles.card}>
          <div className={clsx(styles.frame, styles.frameRaycast)}>
            <GlassBackground {...cardGlass} seed={2} />
            <h3>In your workflow</h3>
            <p>Capture and search with the <Link className={styles.inlineLink} to="/raycast">Raycast link-saving extension</Link> without leaving the keyboard.</p>
            <img
              className={clsx(styles.shot, styles.shotRaycast)}
              src="/raycast-search-1508.webp"
              alt="Searching saved items from Raycast"
              width={1508}
              height={958}
              loading="lazy"
            />
            <BlurFade />
          </div>
          <img
            className={clsx(styles.icon, styles.iconRaycast)}
            src="/raycast-82.webp"
            alt="Raycast extension icon"
            width={82}
            height={82}
            loading="lazy"
          />
          <a className={clsx(styles.cta, styles.ctaRaycast)} href={raycastDeeplink}>
            <img src="/raycast-82.webp" alt="" width={82} height={82} loading="lazy" />
            Add to your Raycast
          </a>
        </article>
      </div>
    </section>
  )
}
