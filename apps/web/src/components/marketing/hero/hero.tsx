import { useEffect, useRef } from "react"
import { Link } from "@tanstack/react-router"

import { GlassBackground } from "../glass-background/glass-background"
import { appStoreUrl } from "../store-links"
import styles from "./hero.module.scss"

/**
 * The homepage hero, after payloadcms.com's: a headline over the two ways in
 * — the iPhone app and the Web Companion — and the product on the right: the
 * Web Companion as a window with the iPhone in front of it — all over a live
 * glass shader that the pointer lights like a lamp. On a phone the App Store
 * leads, and the iPhone stands alone, large, rising out of the bottom edge.
 */
export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null)

  // The loop starts from the effect rather than an autoPlay attribute, so the
  // server HTML is the same for everyone and Reduce Motion keeps the poster.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    void videoRef.current?.play().catch(() => {})
  }, [])

  return (
    <section className={styles.stage} aria-label="Sleevy">
      <GlassBackground />

      <div className={styles.content}>
        <div className={styles.copy}>
          <h1 className={styles.headline}>
            Save it now. <br />
            Read it later.
          </h1>

          <div className={styles.actions}>
            <a className={styles.primary} href={appStoreUrl}>
              <AppleIcon />
              Download for iPhone
            </a>
            {/* Signing in with Apple or Google creates the account, so this is
                both the sign-up and the login. */}
            <Link className={styles.secondary} to="/inbox">
              <span className={styles.wideLabel}>Get started</span>
              <span className={styles.narrowLabel}>Or use Sleevy on the web</span>
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className={styles.media}>
          <div className={styles.frame}>
            {/* Phones hide the frame; the empty source there keeps them from
                downloading a screenshot they never show. */}
            <picture>
              <source media="(max-width: 768px)" srcSet="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />
              <img
                className={styles.webCompanion}
                src="/web-companion-2418.webp"
                srcSet="/web-companion-1209.webp 1209w, /web-companion-2418.webp 2418w"
                sizes="63vw"
                alt="The Sleevy inbox in the Web Companion"
                width={2418}
                height={1508}
                fetchPriority="high"
              />
            </picture>
          </div>

          <div className={styles.phone} role="img" aria-label="The Sleevy inbox on iPhone">
            {/* The screen sits BEHIND the frame: hero-phone-frame.webp has a
                transparent display aperture, so the bezel draws over the app. */}
            <video
              ref={videoRef}
              className={styles.phoneScreen}
              src="/hero-phone-loop.mp4"
              poster="/hero-phone-screen.webp"
              loop
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
            <img className={styles.phoneFrame} src="/hero-phone-frame.webp" alt="" width={1300} height={2650} />
          </div>
        </div>
      </div>
    </section>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M12.665 15.358c-.905.844-1.893.711-2.843.311-1.006-.409-1.93-.427-2.991 0-1.33.551-2.03.391-2.825-.31C-.498 10.886.166 4.078 5.28 3.83c1.246.062 2.114.657 2.843.71 1.09-.213 2.133-.826 3.296-.746 1.393.107 2.446.64 3.138 1.6-2.88 1.662-2.197 5.315.443 6.337-.526 1.333-1.21 2.657-2.345 3.635zM8.03 3.778C7.892 1.794 9.563.16 11.483 0c.268 2.293-2.16 4-3.452 3.777" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 10h11.5M10.5 5l5 5-5 5" />
    </svg>
  )
}
