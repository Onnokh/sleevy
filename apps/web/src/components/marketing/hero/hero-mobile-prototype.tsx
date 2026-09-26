// PROTOTYPE — throwaway.
// Question: what should the homepage hero be on a phone? The desktop hero
// (headline left, Web Companion + iPhone right) shrinks to half size there and
// reads as nothing. These replace the hero's content at ≤768px only, over the
// same live glass, switchable via `?heroMobile=` or the ← → keys:
//   rise    — one big iPhone rising out of the bottom edge, one clear CTA
//   tilt    — a large iPhone at an angle, running off the edge
//   type    — full-screen glass and type, no product (it follows below)
//   duo     — the Web Companion behind, the iPhone in front, both legible
//   current — the desktop layout at half size (baseline)

import { Link, useSearch } from "@tanstack/react-router"
import clsx from "clsx"

import { appStoreUrl } from "../store-links"
import { AppleIcon, ArrowIcon } from "./hero"
import heroStyles from "./hero.module.scss"
import styles from "./hero-mobile-prototype.module.scss"
import { PrototypeSwitcher } from "./prototype-switcher"

const variants = [
  { key: "rise", name: "Rise — iPhone from the bottom" },
  { key: "tilt", name: "Tilt — iPhone at an angle" },
  { key: "type", name: "Type — glass and type only" },
  { key: "duo", name: "Duo — both products, legible" },
  { key: "current", name: "Current — desktop at half size" },
] as const

export type HeroMobileVariant = (typeof variants)[number]["key"]

export function useHeroMobileVariant(): HeroMobileVariant {
  const search = useSearch({ strict: false }) as { heroMobile?: string }
  return variants.find((variant) => variant.key === search.heroMobile)?.key ?? "rise"
}

function Phone({ className }: { className?: string }) {
  return (
    <div className={clsx(styles.phone, className)} role="img" aria-label="The Sleevy inbox on iPhone">
      <video
        className={heroStyles.phoneScreen}
        src="/hero-phone-loop.mp4"
        poster="/hero-phone-screen.webp"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <img className={heroStyles.phoneFrame} src="/hero-phone-frame.webp" alt="" width={1300} height={2650} />
    </div>
  )
}

function Headline({ className }: { className?: string }) {
  return (
    <h1 className={clsx(styles.headline, className)}>
      Save it now. <br />
      Read it later.
    </h1>
  )
}

/** On a phone the App Store is the way in; the Web Companion is the aside. */
function Actions({ stacked }: { stacked?: boolean }) {
  return (
    <div className={styles.actions}>
      <a className={clsx(heroStyles.primary, styles.wide)} href={appStoreUrl}>
        <AppleIcon />
        Download for iPhone
      </a>
      {stacked ? (
        <Link className={clsx(heroStyles.secondary, styles.wide)} to="/inbox">
          Open the Web Companion
          <ArrowIcon />
        </Link>
      ) : (
        <Link className={styles.textLink} to="/inbox">
          Or use Sleevy on the web
          <ArrowIcon />
        </Link>
      )}
    </div>
  )
}

function Content({ variant }: { variant: HeroMobileVariant }) {
  switch (variant) {
    case "rise":
      return (
        <div className={clsx(styles.root, styles.rise)}>
          <div className={styles.copy}>
            <Headline />
            <Actions />
          </div>
          <Phone className={styles.risePhone} />
        </div>
      )
    case "tilt":
      return (
        <div className={clsx(styles.root, styles.tilt)}>
          <div className={styles.copy}>
            <Headline />
            <Actions />
          </div>
          <div className={styles.tiltStage}>
            <Phone className={styles.tiltPhone} />
          </div>
        </div>
      )
    case "type":
      return (
        <div className={clsx(styles.root, styles.type)}>
          <div className={styles.copy}>
            <Headline className={styles.typeHeadline} />
            <p className={styles.lede}>
              Sleevy keeps every link you save, on your iPhone and on the web, until you come back to it.
            </p>
            <Actions stacked />
          </div>
        </div>
      )
    case "duo":
      return (
        <div className={clsx(styles.root, styles.duo)}>
          <div className={styles.copy}>
            <Headline />
            <Actions />
          </div>
          <div className={styles.duoMedia}>
            <div className={styles.duoWindow}>
              <img src="/web-companion-2418.webp" alt="The Sleevy inbox in the Web Companion" width={2418} height={1508} />
            </div>
            <Phone className={styles.duoPhone} />
          </div>
        </div>
      )
    case "current":
      return null
  }
}

export function HeroMobilePrototype({ variant }: { variant: HeroMobileVariant }) {
  return (
    <>
      <Content variant={variant} />
      <PrototypeSwitcher param="heroMobile" variants={variants} current={variant} />
    </>
  )
}
