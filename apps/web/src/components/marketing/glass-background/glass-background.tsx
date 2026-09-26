import { useEffect, useRef, type RefObject } from "react"
import clsx from "clsx"

import { GlassRenderer } from "./glass-shader"
import styles from "./glass-background.module.scss"

type GlassBackgroundProps = {
  readonly className?: string
  /** Brightness of the light behind the glass; the hero uses 1. */
  readonly tone?: number
  /** Strength of the light over the glass while it roams on its own. */
  readonly roamingLight?: number
  /** Strength of the light over the glass while it follows the pointer. */
  readonly pointerLight?: number
  /** Dim the top for text: from `start` to `end` (UV height, y up) down to `floor`. */
  readonly calm?: readonly [start: number, end: number, floor: number]
  /** Varies the panel pattern and the beams' timing, so two frames never match. */
  readonly seed?: number
  /**
   * The height, in rem, that one unit of the glass spans. Defaults to the
   * frame's own height. A smaller frame passes a multiple of the hero's height
   * to zoom into the glass, instead of showing a shrunken copy full of fine ribs.
   */
  readonly glassHeight?: number
  /** The same for the light behind the glass: bigger is broader, softer beams. */
  readonly lightHeight?: number
  /** How fast the light behind the glass drifts; the hero uses 1. */
  readonly speed?: number
  /** Whether the pointer over the parent moves the light. */
  readonly interactive?: boolean
  /**
   * A larger element this frame is a window into. Several frames given the
   * same wall show one continuous wall of glass instead of separate copies.
   */
  readonly wallRef?: RefObject<HTMLElement | null>
}

/** Frame gap while the light roams on its own; the pointer gets every frame. */
const ROAMING_FRAME_INTERVAL = 1000 / 30

/**
 * The marketing glass (glass-shader.ts), filling its positioned parent. The
 * pointer over that parent is a low raking light: it follows the pointer and
 * reveals the ribs and panels, and roams a slow loop while no pointer is there.
 */
export function GlassBackground({
  className,
  tone = 1,
  roamingLight = 0.6,
  pointerLight = 1,
  calm = [0.7, 0.98, 0.5],
  seed = 0,
  glassHeight,
  lightHeight,
  speed = 1,
  interactive = true,
  wallRef,
}: GlassBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Read by the render loop, so new props apply without restarting it.
  const settings = useRef({ tone, roamingLight, pointerLight, calm, seed, glassHeight, lightHeight, speed, interactive })
  useEffect(() => {
    settings.current = { tone, roamingLight, pointerLight, calm, seed, glassHeight, lightHeight, speed, interactive }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    const renderer = GlassRenderer.create(canvas)
    if (!renderer) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const started = performance.now()
    // The pointer in canvas UV (y up), or null while it is off the parent.
    let pointer: [number, number] | null = null
    // Without a pointer the light roams a slow loop over the glass, so the
    // relief still reads on touch screens and before anyone moves.
    const roam = (seconds: number): [number, number] => [
      0.5 + 0.2 * Math.sin(seconds * 0.21),
      0.46 + 0.2 * Math.sin(seconds * 0.33 + 1.1),
    ]
    const light: [number, number] = roam(0)
    let strength = settings.current.roamingLight
    let frame = 0
    let lastDrawn = 0
    let visible = true
    // The root font size is vw-fluid on marketing pages; re-read it on resize.
    let rem = parseFloat(getComputedStyle(document.documentElement).fontSize)

    const draw = (now: number) => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      const current = settings.current
      const seconds = reduceMotion ? 8 : (now - started) / 1000
      const target = pointer ?? roam(seconds)
      // Quick enough to feel held, soft enough to glide.
      const ease = reduceMotion ? 1 : pointer ? 0.14 : 0.05
      light[0] += (target[0] - light[0]) * ease
      light[1] += (target[1] - light[1]) * ease
      strength += ((pointer ? current.pointerLight : current.roamingLight) - strength) * 0.06
      // A soft field: render at up to 1x and let the browser scale it.
      const ratio = Math.min(window.devicePixelRatio || 1, 1)
      const glassUnit = (current.glassHeight ? current.glassHeight * rem : height) * ratio
      const lightUnit = (current.lightHeight ? current.lightHeight * rem : height) * ratio
      // GL counts y from the bottom, so the origin is measured from the wall's bottom-left.
      const own = canvas.getBoundingClientRect()
      const wallBox = wallRef?.current?.getBoundingClientRect() ?? own
      const origin = [(own.left - wallBox.left) * ratio, (wallBox.bottom - own.bottom) * ratio] as const
      const wall = [wallBox.width * ratio, wallBox.height * ratio] as const
      renderer.render({
        time: seconds * current.speed,
        width: Math.round(width * ratio),
        height: Math.round(height * ratio),
        pointer: light,
        lightOn: strength,
        tone: current.tone,
        calm: current.calm,
        seed: current.seed,
        glassUnit,
        lightUnit,
        origin,
        wall,
      })
      lastDrawn = now
    }

    const step = (now: number) => {
      frame = requestAnimationFrame(step)
      if (!visible) return
      if (!pointer && now - lastDrawn < ROAMING_FRAME_INTERVAL) return
      draw(now)
    }
    if (reduceMotion) draw(performance.now())
    else frame = requestAnimationFrame(step)

    const onPointerMove = (event: PointerEvent) => {
      if (!settings.current.interactive) return
      const rect = canvas.getBoundingClientRect()
      pointer = [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height]
    }
    const onPointerLeave = () => {
      pointer = null
    }
    host.addEventListener("pointermove", onPointerMove)
    host.addEventListener("pointerleave", onPointerLeave)

    const intersection = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    intersection.observe(canvas)
    const resize = new ResizeObserver(() => {
      rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
      draw(performance.now())
    })
    resize.observe(canvas)
    // No loseContext() here: a remount gets the same canvas context back, and
    // a lost one stays dead.
    return () => {
      cancelAnimationFrame(frame)
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerleave", onPointerLeave)
      intersection.disconnect()
      resize.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className={clsx(styles.canvas, className)} aria-hidden="true" />
}
