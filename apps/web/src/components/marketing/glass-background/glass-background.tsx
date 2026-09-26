import { useEffect, useRef } from "react"
import clsx from "clsx"

import { GlassRenderer } from "./glass-shader"
import styles from "./glass-background.module.scss"

/** Frame gap while the light roams on its own; the pointer gets every frame. */
const ROAMING_FRAME_INTERVAL = 1000 / 30

/** Strength of the light over the glass while it roams, and while it follows the pointer. */
const ROAMING_LIGHT = 0.6
const POINTER_LIGHT = 1

/**
 * The hero's glass (glass-shader.ts), filling its positioned parent. The
 * pointer over that parent is a low raking light: it follows the pointer and
 * reveals the ribs and panels, and roams a slow loop while no pointer is there.
 */
export function GlassBackground({ className }: { readonly className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
    let strength = ROAMING_LIGHT
    let frame = 0
    let lastDrawn = 0
    let visible = true

    const draw = (now: number) => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      const seconds = reduceMotion ? 8 : (now - started) / 1000
      const target = pointer ?? roam(seconds)
      // Quick enough to feel held, soft enough to glide.
      const ease = reduceMotion ? 1 : pointer ? 0.14 : 0.05
      light[0] += (target[0] - light[0]) * ease
      light[1] += (target[1] - light[1]) * ease
      strength += ((pointer ? POINTER_LIGHT : ROAMING_LIGHT) - strength) * 0.06
      // A soft field: render at up to 1x and let the browser scale it.
      const ratio = Math.min(window.devicePixelRatio || 1, 1)
      renderer.render({
        time: seconds,
        width: Math.round(width * ratio),
        height: Math.round(height * ratio),
        pointer: light,
        lightOn: strength,
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
    const resize = new ResizeObserver(() => draw(performance.now()))
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
