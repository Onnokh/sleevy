// PROTOTYPE — throwaway. The pieces every footer look shares: the same links
// as the current footer, and the hero's two buttons.

import { Link } from "@tanstack/react-router"

import { appStoreUrl } from "../store-links"

/** The footer's link columns. The class names come from each look. */
export function FooterNavs({ col, title }: { col: string; title: string }) {
  return (
    <>
      <nav className={col} aria-label="Integrations">
        <span className={title}>Integrations</span>
        <Link to="/ios-app">iOS</Link>
        <Link to="/raycast">Raycast extension</Link>
        <Link to="/chrome-extension">Chrome read-later extension</Link>
        <Link to="/web-companion">Web Companion</Link>
      </nav>

      <nav className={col} aria-label="Extras">
        <span className={title}>Extras</span>
        <Link to="/articles">Articles</Link>
        <Link to="/docs/$" params={{ _splat: "" }}>Sleevy API documentation</Link>
        <a href="https://github.com/Onnokh/sleevy" target="_blank" rel="noopener noreferrer">GitHub</a>
        <Link to="/support">Support</Link>
        <Link to="/privacy">Privacy</Link>
      </nav>

      {/* Directory listings. These links must stay in the server-rendered HTML:
          the directories re-fetch this page to keep their outbound link dofollow. */}
      <nav className={col} aria-label="Featured on">
        <span className={title}>Featured on</span>
        <a href="https://www.producthunt.com/products/sleevy" target="_blank" rel="noopener noreferrer">Product Hunt</a>
        <a href="https://indiehunt.io/project/sleevy" target="_blank" rel="noopener noreferrer">IndieHunt</a>
        <a href="https://www.scrolllaunch.com/products/sleevy?ref=badge" target="_blank" rel="noopener noreferrer">ScrollLaunch</a>
        <a href="https://buildlist.io" target="_blank" rel="noopener noreferrer">Buildlist</a>
      </nav>
    </>
  )
}

export const brandLine =
  "A scriptable bookmark manager app for saving links, keeping your reading list in sync, and coming back when you are ready."

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

/** The hero's pair: the iPhone download, and Get started (sign-in creates the account). */
export function FooterActions({ className, primary, secondary }: { className?: string; primary: string; secondary: string }) {
  return (
    <div className={className}>
      <a className={primary} href={appStoreUrl}>
        <AppleIcon />
        Download for iPhone
      </a>
      <Link className={secondary} to="/inbox">
        Get started
        <ArrowIcon />
      </Link>
    </div>
  )
}
