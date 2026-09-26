import { Link } from "@tanstack/react-router"
import clsx from "clsx"

import { appStoreUrl, chromeStoreUrl, raycastDeeplink } from "../store-links"
import styles from "./highlight-section.module.scss"

/**
 * Sleevy on every surface, as a bento of solid cards: two wide cards on the
 * left (Raycast, the browser) and one tall card on the right (iPhone), so
 * each screenshot gets a card of its own shape. Solid and quiet, so the hero
 * stays the only glass on the page.
 */
export function HighlightSection() {
  return (
    <section className={styles.section} aria-label="Sleevy on every surface">
      <div className={styles.bento}>
        <article className={clsx(styles.card, styles.wide, styles.raycast)}>
          <div className={styles.copy}>
            <div className={styles.eyebrow}>
              <img src="/raycast-82.webp" alt="" width={82} height={82} loading="lazy" />
              Raycast
            </div>
            <h3>In your workflow</h3>
            <p>
              Capture and search with the{" "}
              <Link className={styles.inlineLink} to="/raycast">
                Raycast link-saving extension
              </Link>{" "}
              without leaving the keyboard.
            </p>
            <a className={styles.cta} href={raycastDeeplink}>
              <img src="/raycast-82.webp" alt="" width={82} height={82} loading="lazy" />
              Add to your Raycast
            </a>
          </div>
          <div className={styles.media}>
            <img
              className={styles.shot}
              src="/raycast-search-1508.webp"
              alt="Searching saved items from Raycast"
              width={1508}
              height={958}
              loading="lazy"
            />
          </div>
        </article>

        <article className={clsx(styles.card, styles.wide, styles.browser)}>
          <div className={styles.copy}>
            <div className={styles.eyebrow}>
              <img src="/chrome-76.webp" alt="" width={76} height={82} loading="lazy" />
              Chrome and the web
            </div>
            <h3>In your browser</h3>
            <p>
              One click in the{" "}
              <Link className={styles.inlineLink} to="/chrome-extension">
                Chrome read-later extension
              </Link>{" "}
              saves the tab you're on. The full library opens in the{" "}
              <Link className={styles.inlineLink} to="/web-companion">
                web app
              </Link>
              .
            </p>
            <a className={styles.cta} href={chromeStoreUrl}>
              <img src="/chrome-76.webp" alt="" width={76} height={82} loading="lazy" />
              Add to Chrome
            </a>
          </div>
          <div className={styles.media}>
            <img
              className={styles.shot}
              src="/web-companion-1209.webp"
              srcSet="/web-companion-1209.webp 1209w, /web-companion-2418.webp 2418w"
              sizes="(max-width: 768px) 90vw, 36rem"
              alt="The Sleevy library in the web app"
              width={1209}
              height={754}
              loading="lazy"
            />
          </div>
        </article>

        <article className={clsx(styles.card, styles.tall, styles.share)}>
          <div className={styles.copy}>
            <div className={styles.eyebrow}>
              <img src="/ios26-82.webp" alt="" width={82} height={82} loading="lazy" />
              iPhone
            </div>
            <h3>Native Share</h3>
            <p>Hit share in any app, pick Sleevy, and the link is saved. Nothing to copy or paste.</p>
            <a className={styles.cta} href={appStoreUrl}>
              <img src="/appstore-glyph-96.webp" alt="" width={96} height={96} loading="lazy" />
              Install on your iPhone
            </a>
          </div>
          <div className={styles.media}>
            <img
              className={styles.shot}
              src="/share-sheet-750.webp"
              alt="iOS share sheet with Sleevy selected"
              width={750}
              height={906}
              loading="lazy"
            />
          </div>
        </article>
      </div>
    </section>
  )
}
