import { useEffect, useRef } from "react"
import clsx from "clsx"

import { GlassRenderer } from "./glass-shader"
import styles from "./glass-background.module.scss"

/** Frame gap while the light roams on its own; the pointer gets every frame. */
const ROAMING_FRAME_INTERVAL = 1000 / 30

/**
 * Strength of the pointer's light while it roams, and while it follows the
 * pointer. The glass has its own moving lights, so the roaming one is faint.
 */
const ROAMING_LIGHT = 0.25
const POINTER_LIGHT = 1

/**
 * The hero's glass (glass-shader.ts), filling its positioned parent. The
 * pointer over that parent is one more light over the ribbons: it follows the
 * pointer, and roams a slow loop, faintly, while no pointer is there.
 *
 * `sceneHeightRem` draws a shorter parent as a band across the middle of a
 * scene that tall, so its ribbons keep the hero's size.
 */
export function GlassBackground({
  className,
  sceneHeightRem,
}: {
  readonly className?: string
  readonly sceneHeightRem?: number
}) {
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
    // Without a pointer the light roams a slow loop over the glass, so it
    // does not jump in from a corner when a pointer arrives.
    const roam = (seconds: number): [number, number] => [
      0.5 + 0.2 * Math.sin(seconds * 0.21),
      0.46 + 0.2 * Math.sin(seconds * 0.33 + 1.1),
    ]
    const light: [number, number] = roam(0)
    let strength = ROAMING_LIGHT
    let frame = 0
    let lastDrawn = 0
    let visible = true
    // The scene's height in CSS pixels for a canvas this tall; the root font
    // is fluid, so it is measured again on every resize.
    let rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const sceneHeightFor = (height: number) => (sceneHeightRem ? Math.max(height, sceneHeightRem * rem) : height)

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
        sceneHeight: Math.round(sceneHeightFor(height) * ratio),
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
      // Into scene UV: the canvas is a band across the scene's middle.
      const scene = sceneHeightFor(rect.height)
      const fromBottom = rect.bottom - event.clientY + (scene - rect.height) / 2
      pointer = [(event.clientX - rect.left) / rect.width, fromBottom / scene]
    }
    const onPointerLeave = () => {
      pointer = null
    }
    host.addEventListener("pointermove", onPointerMove)
    host.addEventListener("pointerleave", onPointerLeave)

    const intersection = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    intersection.observe(canvas)
    const resize = new ResizeObserver(() => {
      rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
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
  }, [sceneHeightRem])

  return (
    <>
      <canvas ref={canvasRef} className={clsx(styles.canvas, className)} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
    </>
  )
}
