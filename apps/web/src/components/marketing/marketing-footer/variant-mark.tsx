// PROTOTYPE — throwaway. "Mark": no call to action. A quiet link grid, and a
// very large Sleevy mark filled with the hero's live glass, cropped by the
// footer's bottom right corner; its three bars echo the glass ribs.

import { GlassBackground } from "../glass-background/glass-background"
import { brandLine, FooterNavs } from "./footer-parts"
import styles from "./variant-mark.module.scss"

export function VariantMark() {
  return (
    <footer className={styles.footer}>
      {/* The canvas is the hero's height, so the ribs are the hero's size. */}
      <div className={styles.mark} aria-hidden="true">
        <div className={styles.glassScale}>
          <GlassBackground />
        </div>
      </div>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <img src="/logo-mark-white.svg" alt="Sleevy logo" width={27} height={34} />
            <span>Sleevy</span>
          </div>
          <p>{brandLine}</p>
        </div>
        <div className={styles.navs}>
          <FooterNavs col={styles.col} title={styles.colTitle} />
        </div>
      </div>
    </footer>
  )
}
