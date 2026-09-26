// PROTOTYPE — throwaway. Variant "prism", after vgpu.sh: a black full-bleed
// stage, a WebGL reverse prism on the right, and on the left a wordmark, one
// line of copy, and a channel tab row whose action line swaps per tab. The
// active tab's beam brightens in the scene.

import { useEffect, useRef, useState } from "react"
import clsx from "clsx"

import { channels } from "./channels"
import { PrismRenderer } from "./prism-shader"
import { useCopy } from "./use-copy"
import styles from "./variant-prism.module.scss"

const rgb = ([r, g, b]: readonly [number, number, number]) => `rgb(${r * 255} ${g * 255} ${b * 255})`

export function VariantPrism() {
  const [active, setActive] = useState(channels.length - 1)
  const activeRef = useRef(active)
  activeRef.current = active
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerTarget = useRef<[number, number]>([0, 0])
  const { copied, copy } = useCopy()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = PrismRenderer.create(canvas)
    if (!renderer) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const pointer: [number, number] = [0, 0]
    const intensity = channels.map(() => 0.8)
    const colors = channels.map((channel) => channel.beam)
    const started = performance.now()
    let frame = 0
    let visible = true

    const draw = (now: number) => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      const ease = reduceMotion ? 1 : 0.08
      pointer[0] += (pointerTarget.current[0] - pointer[0]) * ease
      pointer[1] += (pointerTarget.current[1] - pointer[1]) * ease
      channels.forEach((_, index) => {
        const target = index === activeRef.current ? 1.7 : 0.55
        intensity[index] += (target - intensity[index]) * (reduceMotion ? 1 : 0.1)
      })
      renderer.render({
        time: (now - started) / 1000,
        width: Math.round(width * ratio),
        height: Math.round(height * ratio),
        pointer,
        intensity,
        colors,
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
    pointerTarget.current = [
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    ]
  }

  const channel = channels[active]

  return (
    <section
      className={styles.stage}
      aria-label="Sleevy"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => (pointerTarget.current = [0, 0])}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.overlay}>
        <div className={styles.copy}>
          <h1 className={styles.wordmark}>
            <img src="/logo-mark-white.svg" alt="" width={462} height={587} />
            Sleevy
          </h1>
          <p className={styles.tagline}>The read-later app for every device, script, and agent.</p>

          <div className={styles.tabs}>
            <div className={styles.tabList} role="tablist" aria-label="Where you save from">
              {channels.map((item, index) => (
                <span key={item.key} className={styles.tabItem}>
                  {index > 0 && <span className={styles.dot} aria-hidden="true">·</span>}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={index === active}
                    className={clsx(styles.tab, index === active && styles.tabActive)}
                    onClick={() => setActive(index)}
                    onMouseEnter={() => setActive(index)}
                  >
                    {item.label}
                  </button>
                </span>
              ))}
            </div>
            <div className={styles.rule} style={{ "--beam": rgb(channel.beam) } as React.CSSProperties} aria-hidden="true" />
            <div className={styles.actionStack}>
              {channels.map((item, index) => {
                const shown = index === active
                const { action } = item
                return action.kind === "link" ? (
                  <a
                    key={item.key}
                    className={clsx(styles.action, shown && styles.actionShown)}
                    href={action.href}
                    aria-hidden={!shown}
                    tabIndex={shown ? 0 : -1}
                  >
                    {action.text} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    className={clsx(styles.action, styles.actionCode, shown && styles.actionShown)}
                    onClick={() => copy(action.copy)}
                    aria-hidden={!shown}
                    tabIndex={shown ? 0 : -1}
                  >
                    <code>{action.text}</code>
                    <span className={styles.copyHint}>{copied === action.copy ? "Copied" : "Copy"}</span>
                  </button>
                )
              })}
            </div>
            <p className={styles.pitch}>{channel.pitch}</p>
          </div>
        </div>
      </div>
      <div className={styles.fade} aria-hidden="true" />
    </section>
  )
}
