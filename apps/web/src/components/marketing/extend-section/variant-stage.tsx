// PROTOTYPE — throwaway. "Stage": one wide window. The prompts are tabs over
// it (the vgpu switcher), the conversation plays on the left, and a simplified
// Web Companion on the right changes as the agent works. The two ways in sit in two
// short columns under it.

import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import clsx from "clsx"
import { m } from "motion/react"

import { ClaudeMark, OpenAIMark } from "./agent-logos"
import {
  ChatWindow,
  Composer,
  ConversationSlides,
  conversations,
  AppPane,
  paneAt,
  useConversationPlayer,
} from "./agent-conversations"
import { api, ArrowIcon, CopyButton, mcp, mcpSnippet } from "./extend-snippets"
import styles from "./variant-stage.module.scss"

export function VariantStage() {
  const sectionRef = useRef<HTMLElement>(null)
  const { active, step, direction, select } = useConversationPlayer(sectionRef)
  const conversation = conversations[active]

  // One pill that slides to the active tab, measured from the tab itself.
  const tabsRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)
  useEffect(() => {
    const tabs = tabsRef.current
    if (!tabs) return
    const measure = () => {
      const tab = tabs.querySelectorAll<HTMLElement>("[role=tab]")[active]
      if (tab) setPill({ x: tab.offsetLeft, width: tab.offsetWidth })
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(tabs)
    return () => resize.disconnect()
  }, [active])

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="extend-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <h2 className={styles.statement} id="extend-title">
            Built to extend. <span>Your agent can work your queue.</span>
          </h2>
          <div className={styles.worksWith}>
            <span>Works with</span>
            <ClaudeMark className={styles.logo} />
            Claude
            <OpenAIMark className={styles.logo} />
            ChatGPT
            <span>and any MCP client</span>
          </div>
        </div>

        <div ref={tabsRef} className={styles.tabs} role="tablist" aria-label="Things to ask your agent">
          {pill && (
            <m.span
              className={styles.pill}
              aria-hidden="true"
              initial={false}
              animate={pill}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            />
          )}
          {conversations.map((candidate, index) => (
            <button
              key={candidate.prompt}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={clsx(styles.tab, index === active && styles.tabActive)}
              onClick={() => select(index)}
            >
              {candidate.prompt}
            </button>
          ))}
        </div>

        <ChatWindow client={conversation.client} className={styles.window} composer={false}>
          <div className={styles.panes}>
            <div className={styles.chat}>
              <ConversationSlides active={active} step={step} direction={direction} />
              <Composer client={conversation.client} />
            </div>
            <AppPane state={paneAt(active, step)} />
          </div>
        </ChatWindow>

        <div className={styles.ways}>
          <div>
            <h3>{mcp.title}</h3>
            <p>Sign in once with OAuth and approve only what the agent needs. No API Key to paste.</p>
            <div className={styles.install}>
              <code>npx add-mcp https://api.sleevy.app/mcp --name sleevy</code>
              <CopyButton snippet={mcpSnippet} />
            </div>
            <Link to="/docs/$" params={{ _splat: mcp.splat }}>
              {mcp.cta}
              <ArrowIcon />
            </Link>
          </div>
          <div>
            <h3>{api.title}</h3>
            <p>{api.body} JSON over HTTPS, with scoped API Keys and an OpenAPI 3.1 schema.</p>
            <Link to="/docs/$" params={{ _splat: api.splat }}>
              {api.cta}
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
