// PROTOTYPE — throwaway. "Quiet": no shader. The page's own type system — a
// statement with its grey half, grey links, hairlines — and a bottom bar with
// the hero's two buttons.

import { FooterActions, FooterNavs } from "./footer-parts"
import styles from "./variant-quiet.module.scss"

export function VariantQuiet() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <p className={styles.statement}>
            Sleevy is a bookmark manager. <span>Save a link now, and come back to it when you are ready.</span>
          </p>
          <div className={styles.navs}>
            <FooterNavs col={styles.col} title={styles.colTitle} />
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.logo}>
            <img src="/logo-mark-white.svg" alt="Sleevy logo" width={27} height={34} />
            <span>Sleevy</span>
          </div>
          <FooterActions className={styles.actions} primary={styles.primary} secondary={styles.secondary} />
        </div>
      </div>
    </footer>
  )
}
