import { type CSSProperties, useEffect, useRef, useSyncExternalStore } from "react"
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

/** Phones get the still and no shader: it saves their GPU and battery. */
const PHONE = "(max-width: 768px)"

/**
 * The glass's first frame, pre-rendered. The shader draws exactly this at
 * time 0, so the live canvas lands on it without a jump. Re-render both
 * whenever glass-shader.ts changes: `GlassRenderer.render` at time 0, pointer
 * `roam(0)`, lightOn ROAMING_LIGHT, at 2400×1000 (the 12:5 the still's CSS
 * assumes) and 480×1040, then `cwebp -q 90 -m 6 -sns 0 -f 0 -sharp_yuv`.
 */
const STILL_WIDE = "/glass-still-wide.webp"
const STILL_PORTRAIT = "/glass-still-portrait.webp"

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/**
 * The hero's glass (glass-shader.ts), filling its positioned parent. It opens
 * on a still of its first frame, which paints at once; the live shader takes
 * over when its first frame is drawn. Phones, and visitors who ask for
 * reduced motion, keep the still. The pointer over the parent is one more
 * light over the ribbons: it follows the pointer, and roams a slow loop,
 * faintly, while no pointer is there.
 *
 * `sceneHeightRem` draws a shorter parent as a band across the middle of a
 * scene that tall, so its ribbons keep the hero's size. `lazy` is for glass
 * below the fold, whose still can wait.
 */
export function GlassBackground({
  className,
  sceneHeightRem,
  lazy,
}: {
  readonly className?: string
  readonly sceneHeightRem?: number
  readonly lazy?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phone = useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE).matches,
    () => false,
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    if (phone || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const renderer = GlassRenderer.create(canvas)
    if (!renderer) return

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
      const seconds = (now - started) / 1000
      const target = pointer ?? roam(seconds)
      // Quick enough to feel held, soft enough to glide.
      const ease = pointer ? 0.14 : 0.05
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
      // Drawn: the canvas can cover the still.
      canvas.dataset.drawn = ""
      lastDrawn = now
    }

    const step = (now: number) => {
      frame = requestAnimationFrame(step)
      if (!visible) return
      if (!pointer && now - lastDrawn < ROAMING_FRAME_INTERVAL) return
      draw(now)
    }
    frame = requestAnimationFrame(step)

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
      delete canvas.dataset.drawn
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerleave", onPointerLeave)
      intersection.disconnect()
      resize.disconnect()
    }
  }, [sceneHeightRem, phone])

  return (
    <>
      <picture>
        <source media={PHONE} srcSet={STILL_PORTRAIT} />
        <img
          className={styles.still}
          src={STILL_WIDE}
          alt=""
          width={2400}
          height={1000}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          style={sceneHeightRem ? ({ "--scene-height": `${sceneHeightRem}rem` } as CSSProperties) : undefined}
        />
      </picture>
      <canvas ref={canvasRef} className={clsx(styles.canvas, className)} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />
    </>
  )
}
