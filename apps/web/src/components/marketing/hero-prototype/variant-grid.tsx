// PROTOTYPE — throwaway. Variant "grid", rebuilt on payloadcms.com's measured
// hero (1440×900): flat nav, 64px gutters, four 328px columns drawn as rules,
// a 64px headline, a two-row CTA stack exactly one column wide, and two
// 902px glass-framed windows bleeding off the right edge. Payload's looping
// glass video is replaced by a live shader (glass-shader.ts).

import { useEffect, useRef } from "react"
import { Link } from "@tanstack/react-router"
import clsx from "clsx"

import { appStoreUrl } from "../store-links"
import { useCopy } from "./use-copy"
import { GlassRenderer } from "./glass-shader"
import styles from "./variant-grid.module.scss"

// The full `npx add-mcp https://api.sleevy.app/mcp --name sleevy` is 52
// characters and cannot fit one Payload column; the server URL is the part
// every MCP client asks for.
const mcpUrl = "https://api.sleevy.app/mcp"

export function VariantGrid() {
  const { copied, copy } = useCopy()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The pointer's position in canvas UV (y up), or null while it is off the hero.
  const pointerTarget = useRef<[number, number] | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = GlassRenderer.create(canvas)
    if (!renderer) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const started = performance.now()
    // Without a pointer the light roams a slow loop over the open glass, so
    // the relief still reads on touch screens and before anyone moves.
    const roam = (seconds: number): [number, number] => [
      0.5 + 0.2 * Math.sin(seconds * 0.21),
      0.46 + 0.2 * Math.sin(seconds * 0.33 + 1.1),
    ]
    const light: [number, number] = roam(0)
    let strength = 0.6
    let frame = 0
    let visible = true

    const draw = (now: number) => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      const seconds = reduceMotion ? 8 : (now - started) / 1000
      const target = pointerTarget.current ?? roam(seconds)
      // Quick enough to feel held, soft enough to glide.
      const ease = reduceMotion ? 1 : pointerTarget.current ? 0.14 : 0.05
      light[0] += (target[0] - light[0]) * ease
      light[1] += (target[1] - light[1]) * ease
      strength += ((pointerTarget.current ? 1 : 0.6) - strength) * 0.06
      // A soft field: render at up to 1x and let the browser scale it.
      const ratio = Math.min(window.devicePixelRatio || 1, 1)
      renderer.render({
        time: seconds,
        width: Math.round(width * ratio),
        height: Math.round(height * ratio),
        pointer: light,
        lightOn: strength,
      })
    }

    const step = (now: number) => {
      frame = requestAnimationFrame(step)
      if (visible) draw(now)
    }
    if (reduceMotion) draw(performance.now())
    else frame = requestAnimationFrame(step)

    const intersection = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    intersection.observe(canvas)
    const resize = new ResizeObserver(() => draw(performance.now()))
    resize.observe(canvas)
    return () => {
      cancelAnimationFrame(frame)
      intersection.disconnect()
      resize.disconnect()
    }
  }, [])

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    pointerTarget.current = [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height]
  }

  return (
    <section
      className={styles.stage}
      aria-label="Sleevy"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => (pointerTarget.current = null)}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.rules} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <header className={styles.nav}>
        <Link className={styles.brand} to="/" aria-label="Sleevy home">
          <img src="/logo-mark-white.svg" alt="" width={462} height={587} />
          Sleevy
        </Link>
        <nav className={styles.navLinks} aria-label="Primary">
          <Link to="/ios-app">iOS</Link>
          <Link to="/raycast">Raycast</Link>
          <Link to="/chrome-extension">Chrome</Link>
          <Link to="/web-companion">Web</Link>
          <Link to="/docs/$" params={{ _splat: "" }}>Docs</Link>
        </nav>
        <div className={styles.navEnd}>
          <a className={styles.github} href="https://github.com/Onnokh/sleevy" target="_blank" rel="noopener noreferrer" aria-label="Sleevy on GitHub">
            <GitHubIcon />
          </a>
          <Link to="/inbox">Login</Link>
          <a className={styles.navButton} href={appStoreUrl}>Download</a>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.left}>
          <h1 className={styles.headline}>
            One queue for <br />
            every link <br />
            you save.
          </h1>

          <ul className={styles.stack}>
            <li>
              <button type="button" className={clsx(styles.row, styles.rowCode)} onClick={() => copy(mcpUrl)}>
                <RollLabel>
                  <code>
                    <span className={styles.dim}>mcp</span> {mcpUrl.replace("https://", "")}
                  </code>
                </RollLabel>
                <span className={styles.rowIcon} aria-label={copied ? "Copied" : "Copy MCP server URL"}>
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </span>
              </button>
            </li>
            <li>
              <a className={styles.row} href={appStoreUrl}>
                <RollLabel>Download for iPhone</RollLabel>
                <span className={styles.rowIcon} aria-hidden="true"><ArrowIcon /></span>
              </a>
            </li>
          </ul>
        </div>

        <div className={styles.media} aria-hidden="true">
          <div className={clsx(styles.frame, styles.front)}>
            <div className={styles.browser}>
              <img src="/web-companion-2418.webp" alt="" width={2418} height={1508} />
            </div>
          </div>

          <div className={clsx(styles.frame, styles.back)}>
            <div className={styles.terminal}>
              <div className={styles.bar}>
                <i /><i /><i />
                <span className={styles.barTitle}>~/reading — agent</span>
              </div>
              <pre className={styles.terminalBody}>
                <span className={styles.dim}>~/reading $</span> npx add-mcp https://api.sleevy.app/mcp --name sleevy{"\n"}
                <span className={styles.ok}>✓</span> Added <b>sleevy</b>{"\n"}
                {"\n"}
                <span className={styles.you}>›</span> Save the links from this thread{"\n"}
                {"  "}to my Sleevy inbox{"\n"}
                {"\n"}
                <span className={styles.tool}>⏺ save_link</span>{"\n"}
                {"  "}craigmod.com/essays/fast_software{"\n"}
                {"  "}<span className={styles.dim}>⎿ created · Inbox</span>{"\n"}
                <span className={styles.tool}>⏺ save_link</span>{"\n"}
                {"  "}metr.org/blog/agent-hacking{"\n"}
                {"  "}<span className={styles.dim}>⎿ created · Inbox</span>{"\n"}
                <span className={styles.tool}>⏺ save_link</span>{"\n"}
                {"  "}tanstack.com/blog/router-navigation{"\n"}
                {"  "}<span className={styles.dim}>⎿ updated · already saved</span>{"\n"}
                {"\n"}
                Saved 3 links. Two are new, one{"\n"}
                was already in your queue.{"\n"}
                {"\n"}
                <span className={styles.you}>›</span> <span className={styles.caret} />
              </pre>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.fade} aria-hidden="true" />
    </section>
  )
}

/** Payload's hover: the label rolls up and an identical copy rolls in from below. */
function RollLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className={styles.roll}>
      <span className={styles.rollLabel}>{children}</span>
      <span className={styles.rollLabel} aria-hidden="true">{children}</span>
    </span>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="6.5" y="6.5" width="10" height="10" rx="1" />
      <path d="M13.5 6.5V3.5h-10v10h3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M5.5 14.5 14.5 5.5M7 5.5h7.5V13" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.78.4.08.55-.18.55-.4 0-.2-.01-.86-.01-1.56-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.16-.68-.56-.01-.57.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.43 7.43 0 0 1 8 3.94c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.25.54.75.54 1.52 0 1.09-.01 1.98-.01 2.25 0 .22.15.48.55.4A8.14 8.14 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
    </svg>
  )
}
