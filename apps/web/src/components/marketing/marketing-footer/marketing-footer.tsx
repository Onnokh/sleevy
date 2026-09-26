import { Link } from "@tanstack/react-router"

import { GlassBackground } from "../glass-background/glass-background"
import { appStoreUrl } from "../store-links"
import styles from "./marketing-footer.module.scss"

function AppleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M12.665 15.358c-.905.844-1.893.711-2.843.311-1.006-.409-1.93-.427-2.991 0-1.33.551-2.03.391-2.825-.31C-.498 10.886.166 4.078 5.28 3.83c1.246.062 2.114.657 2.843.71 1.09-.213 2.133-.826 3.296-.746 1.393.107 2.446.64 3.138 1.6-2.88 1.662-2.197 5.315.443 6.337-.526 1.333-1.21 2.657-2.345 3.635zM8.03 3.778C7.892 1.794 9.563.16 11.483 0c.268 2.293-2.16 4-3.452 3.777" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11.5M10.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The page closes the way it opens: a full-width row of the hero's satin
 * glass with a closing line and the hero's two buttons, and the links under
 * it.
 */
export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <section className={styles.cta} aria-labelledby="footer-cta-title">
        {/* Drawn as the middle of a scene as tall as the hero (56.25rem at
            1440×900), so the ribbons are the hero's size. */}
        <div className={styles.glass}>
          <GlassBackground sceneHeightRem={56.25} lazy />
        </div>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle} id="footer-cta-title">
            Ready when you are.
          </h2>
          <p className={styles.ctaBody}>Save a link now, and Sleevy keeps it until you come back to it.</p>
          <div className={styles.actions}>
            <a className={styles.primary} href={appStoreUrl}>
              <AppleIcon />
              Download for iPhone
            </a>
            {/* Signing in with Apple or Google creates the account, so this is both the sign-up and the login. */}
            <Link className={styles.secondary} to="/inbox">
              Get started
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <img src="/logo-mark-white.svg" alt="Sleevy logo" width={27} height={34} />
            <span>Sleevy</span>
          </div>
          <p>
            A scriptable bookmark manager app for saving links, keeping your reading list in sync, and coming
            back when you are ready.
          </p>
        </div>

        <nav className={styles.col} aria-label="Integrations">
          <span className={styles.colTitle}>Integrations</span>
          <Link to="/ios-app">iOS</Link>
          <Link to="/raycast">Raycast extension</Link>
          <Link to="/chrome-extension">Chrome read-later extension</Link>
          <Link to="/web-companion">Web Companion</Link>
        </nav>

        <nav className={styles.col} aria-label="Extras">
          <span className={styles.colTitle}>Extras</span>
          <Link to="/articles">Articles</Link>
          <Link to="/docs/$" params={{ _splat: "" }}>Sleevy API documentation</Link>
          <a href="https://github.com/Onnokh/sleevy" target="_blank" rel="noopener noreferrer">GitHub</a>
          <Link to="/support">Support</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>

        {/* Directory listings. These links must stay in the server-rendered HTML:
            the directories re-fetch this page to keep their outbound link dofollow. */}
        <nav className={styles.col} aria-label="Featured on">
          <span className={styles.colTitle}>Featured on</span>
          <a href="https://www.producthunt.com/products/sleevy" target="_blank" rel="noopener noreferrer">Product Hunt</a>
          <a href="https://indiehunt.io/project/sleevy" target="_blank" rel="noopener noreferrer">IndieHunt</a>
          <a href="https://www.scrolllaunch.com/products/sleevy?ref=badge" target="_blank" rel="noopener noreferrer">ScrollLaunch</a>
          <a href="https://buildlist.io" target="_blank" rel="noopener noreferrer">Buildlist</a>
        </nav>
      </div>
    </footer>
  )
}
