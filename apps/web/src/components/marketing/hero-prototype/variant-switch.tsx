// PROTOTYPE — throwaway. Variant "switch", a hybrid: Payload's bordered stack
// becomes vgpu's channel tabs. Each row is a Capture Channel; the active row
// opens to show its action and swaps the product visual on the right. Rows
// advance on their own until the visitor picks one.

import { useEffect, useState } from "react"
import clsx from "clsx"

import { channels, type Channel } from "./channels"
import { useCopy } from "./use-copy"
import styles from "./variant-switch.module.scss"

const DWELL_MS = 6000

export function VariantSwitch() {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  const { copied, copy } = useCopy()

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = setTimeout(() => setActive((index) => (index + 1) % channels.length), DWELL_MS)
    return () => clearTimeout(timer)
  }, [active, auto])

  const pick = (index: number) => {
    setAuto(false)
    setActive(index)
  }

  return (
    <section className={styles.stage} aria-label="Sleevy">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.rules} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className={styles.inner}>
        <div className={styles.left}>
          <p className={styles.kicker}>Read-later app · REST API · MCP server</p>
          <h1 className={styles.headline}>Save it from anywhere. Read it in one place.</h1>

          <div className={styles.stack} role="tablist" aria-label="Where you save from" aria-orientation="vertical">
            {channels.map((channel, index) => {
              const open = index === active
              return (
                <div key={channel.key} className={clsx(styles.row, open && styles.rowOpen)}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={open}
                    className={styles.rowHead}
                    onClick={() => pick(index)}
                  >
                    <ChannelIcon channel={channel} />
                    <span className={styles.rowLabel}>{channel.label}</span>
                    <span className={styles.rowPitch}>{channel.pitch}</span>
                  </button>
                  <div className={styles.rowBody}>
                    <div className={styles.rowBodyInner}>
                      {channel.action.kind === "link" ? (
                        <a className={styles.rowAction} href={channel.action.href} tabIndex={open ? 0 : -1}>
                          {channel.action.text} <span aria-hidden="true">↗</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          className={clsx(styles.rowAction, styles.rowCode)}
                          onClick={() => channel.action.kind === "copy" && copy(channel.action.copy)}
                          tabIndex={open ? 0 : -1}
                        >
                          <code>$ {channel.action.text}</code>
                          <span className={styles.copyHint}>
                            {copied === channel.action.copy ? "Copied" : "Copy"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                  {open && auto && <span key={active} className={styles.progress} aria-hidden="true" />}
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.visuals} aria-hidden="true">
          {channels.map((channel, index) => (
            <div key={channel.key} className={clsx(styles.visual, index === active && styles.visualShown)}>
              <Visual channel={channel} shown={index === active} />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.fade} aria-hidden="true" />
    </section>
  )
}

function Visual({ channel, shown }: { channel: Channel; shown: boolean }) {
  switch (channel.key) {
    case "iphone":
      return (
        <div className={styles.phone}>
          {shown ? (
            <video className={styles.phoneScreen} src="/hero-phone-loop.mp4" poster="/hero-phone-screen.webp" autoPlay loop muted playsInline />
          ) : (
            <img className={styles.phoneScreen} src="/hero-phone-screen.webp" alt="" />
          )}
          <img className={styles.phoneFrame} src="/hero-phone-frame.webp" alt="" width={1300} height={2650} />
        </div>
      )
    case "chrome":
      return (
        <div className={clsx(styles.window, styles.chrome)}>
          <div className={styles.windowBar}>
            <i /><i /><i />
            <span className={styles.url}>craigmod.com/essays/fast_software</span>
            <span className={styles.extension}>
              <img src="/logo-mark-white.svg" alt="" />
            </span>
          </div>
          <div className={styles.article}>
            <span className={styles.articleKicker}>Essay</span>
            <span className={styles.articleTitle}>Fast Software, the Best Software</span>
            <span className={styles.articleLine} style={{ width: "92%" }} />
            <span className={styles.articleLine} style={{ width: "86%" }} />
            <span className={styles.articleLine} style={{ width: "90%" }} />
            <span className={styles.articleLine} style={{ width: "64%" }} />
            <span className={styles.articleLine} style={{ width: "88%", marginTop: "1.2rem" }} />
            <span className={styles.articleLine} style={{ width: "80%" }} />
            <span className={styles.articleLine} style={{ width: "84%" }} />
          </div>
          <div className={styles.popup}>
            <span className={styles.popupCheck}>✓</span>
            <span>
              <b>Saved to Inbox</b>
              <small>Fast Software, the Best Software</small>
            </span>
          </div>
        </div>
      )
    case "raycast":
      return (
        <div className={clsx(styles.window, styles.raycast)}>
          <img src="/raycast-search-1508.webp" alt="" width={1508} height={958} />
        </div>
      )
    case "web":
      return (
        <div className={clsx(styles.window, styles.web)}>
          <div className={styles.windowBar}>
            <i /><i /><i />
            <span className={styles.url}>sleevy.app/inbox</span>
          </div>
          <img src="/web-companion-2418.webp" alt="" width={2418} height={1508} />
        </div>
      )
    case "api":
      return (
        <div className={clsx(styles.window, styles.code)}>
          <div className={styles.windowBar}>
            <i /><i /><i />
            <span className={styles.windowTitle}>save.sh</span>
          </div>
          <pre className={styles.codeBody}>
            <span className={styles.dim}>$</span> curl https://api.sleevy.app/v1/captures \{"\n"}
            {"    "}-H <span className={styles.str}>"Authorization: Bearer $SLEEVY_API_KEY"</span> \{"\n"}
            {"    "}-H <span className={styles.str}>"Content-Type: application/json"</span> \{"\n"}
            {"    "}-d <span className={styles.str}>{`'{"url":"https://craigmod.com/essays/fast_software",`}</span>{"\n"}
            {"         "}<span className={styles.str}>{`"captureChannel":"api"}'`}</span>{"\n"}
            {"\n"}
            <span className={styles.dim}>HTTP/2 201</span>{"\n"}
            {"{"}{"\n"}
            {"  "}<span className={styles.key}>"captureResult"</span>: <span className={styles.str}>"created"</span>,{"\n"}
            {"  "}<span className={styles.key}>"savedItem"</span>: {"{"}{"\n"}
            {"    "}<span className={styles.key}>"url"</span>: <span className={styles.str}>"https://craigmod.com/essays/fast_software"</span>,{"\n"}
            {"    "}<span className={styles.key}>"isRead"</span>: <span className={styles.key}>false</span>,{"\n"}
            {"    "}<span className={styles.dim}>…</span>{"\n"}
            {"  }"}{"\n"}
            {"}"}
          </pre>
        </div>
      )
    case "mcp":
      return (
        <div className={clsx(styles.window, styles.code)}>
          <div className={styles.windowBar}>
            <i /><i /><i />
            <span className={styles.windowTitle}>~/reading — agent</span>
          </div>
          <pre className={styles.codeBody}>
            <span className={styles.you}>›</span> Save the links from this thread, then{"\n"}
            {"  "}show me what is unread.{"\n"}
            {"\n"}
            <span className={styles.tool}>⏺ sleevy.save_link</span> craigmod.com/essays/fast_software{"\n"}
            {"  "}<span className={styles.dim}>⎿ created</span>{"\n"}
            <span className={styles.tool}>⏺ sleevy.save_link</span> metr.org/blog/agent-hacking{"\n"}
            {"  "}<span className={styles.dim}>⎿ created</span>{"\n"}
            <span className={styles.tool}>⏺ sleevy.list_saved_items</span> limit: 5{"\n"}
            {"  "}<span className={styles.dim}>⎿ 5 saved items</span>{"\n"}
            {"\n"}
            Saved 2 links. Unread at the top of your queue:{"\n"}
            {"\n"}
            {"  "}1. Fast Software, the Best Software{"\n"}
            {"  "}2. Agents' behavior in the METR incident{"\n"}
            {"  "}3. Understanding Monomorphism in JS{"\n"}
          </pre>
        </div>
      )
  }
}

function ChannelIcon({ channel }: { channel: Channel }) {
  const src = {
    iphone: "/appstore-glyph-96.webp",
    chrome: "/chrome-76.webp",
    raycast: "/raycast-82.webp",
    web: "/logo-mark-white.svg",
    api: null,
    mcp: null,
  }[channel.key]
  return (
    <span className={styles.icon}>
      {src ? <img src={src} alt="" /> : <span className={styles.iconText}>{channel.key === "api" ? "{ }" : "⌁"}</span>}
    </span>
  )
}
