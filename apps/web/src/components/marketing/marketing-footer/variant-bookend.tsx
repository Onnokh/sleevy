// PROTOTYPE — throwaway. "Bookend": the page closes the way it opens. A band
// of the hero's fluted glass rises out of the dark with a closing line and the
// hero's buttons; the links sit under it on hairlines.

import { GlassBackground } from "../glass-background/glass-background"
import { brandLine, FooterActions, FooterNavs } from "./footer-parts"
import styles from "./variant-bookend.module.scss"

export function VariantBookend() {
  return (
    <footer className={styles.footer}>
      <section className={styles.cta} aria-labelledby="footer-cta-title">
        {/* The canvas is the hero's height, so its ribs are the hero's size;
            the band shows a window of it. */}
        <div className={styles.glass}>
          <div className={styles.glassScale}>
            <GlassBackground />
          </div>
        </div>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle} id="footer-cta-title">
            Ready when you are.
          </h2>
          <p className={styles.ctaBody}>Save a link now, and Sleevy keeps it until you come back to it.</p>
          <FooterActions className={styles.actions} primary={styles.primary} secondary={styles.secondary} />
        </div>
      </section>

      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <img src="/logo-mark-white.svg" alt="Sleevy logo" width={27} height={34} />
            <span>Sleevy</span>
          </div>
          <p>{brandLine}</p>
        </div>
        <FooterNavs col={styles.col} title={styles.colTitle} />
      </div>
    </footer>
  )
}
