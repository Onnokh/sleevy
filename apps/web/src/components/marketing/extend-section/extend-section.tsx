import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import clsx from "clsx"
import { m, MotionConfig } from "motion/react"

import { AgentDemo, useConversationPlayer } from "./agent-demo"
import { conversations } from "./agent-demo-script"
import { ClaudeMark, OpenAIMark } from "./client-marks"
import styles from "./extend-section.module.scss"

const installCommand = "npx add-mcp https://api.sleevy.app/mcp --name sleevy"

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11.5M10.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={styles.copy}
      aria-label={copied ? "Copied" : "Copy the command"}
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }}
    >
      {copied ? (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )}
    </button>
  )
}

/**
 * "Built to extend.": the MCP server and the REST API. Example requests play
 * as an agent at work (agent-demo.tsx), and one pill slides to the request
 * that plays; the two ways in sit in two columns under it.
 */
export function ExtendSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const { active, step, direction, select } = useConversationPlayer(sectionRef)

  // One pill that slides to the active request, measured from its button.
  const promptsRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; width: number } | null>(null)
  useEffect(() => {
    const prompts = promptsRef.current
    if (!prompts) return
    const measure = () => {
      const button = prompts.querySelectorAll<HTMLElement>("button")[active]
      if (button) setPill({ x: button.offsetLeft, width: button.offsetWidth })
    }
    measure()
    // On a phone the row scrolls sideways: bring the playing request into
    // view inside the row, without moving the page.
    const button = prompts.querySelectorAll<HTMLElement>("button")[active]
    if (button && prompts.scrollWidth > prompts.clientWidth) {
      prompts.scrollTo({ left: button.offsetLeft - (prompts.clientWidth - button.offsetWidth) / 2, behavior: "smooth" })
    }
    const resize = new ResizeObserver(measure)
    resize.observe(prompts)
    return () => resize.disconnect()
  }, [active])

  return (
    // Reduced motion keeps the fades and drops the slides.
    <MotionConfig reducedMotion="user">
      <section ref={sectionRef} className={styles.section} aria-labelledby="extend-title">
        <div className={styles.inner}>
          <div className={styles.head}>
            <h2 className={styles.statement} id="extend-title">
              Built to extend. <span>Your agent can work your queue.</span>
            </h2>
            <p className={styles.worksWith}>
              <span>Works with</span>
              <ClaudeMark className={styles.mark} />
              Claude
              <OpenAIMark className={styles.mark} />
              ChatGPT
              <span>and any MCP client</span>
            </p>
          </div>

          <div ref={promptsRef} className={styles.prompts} role="group" aria-label="Example requests">
            {pill && (
              <m.span
                className={styles.pill}
                aria-hidden="true"
                initial={false}
                animate={pill}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
              />
            )}
            {conversations.map((conversation, index) => (
              <button
                key={conversation.prompt}
                type="button"
                aria-pressed={index === active}
                className={clsx(styles.prompt, index === active && styles.promptActive)}
                onClick={() => select(index)}
              >
                {conversation.prompt}
              </button>
            ))}
          </div>

          <AgentDemo active={active} step={step} direction={direction} className={styles.demo} />

          <div className={styles.ways}>
            <div>
              <h3>MCP server</h3>
              <p>
                Connect the <Link to="/docs/$" params={{ _splat: "mcp" }}>Sleevy MCP server</Link> to Claude, ChatGPT, or
                any MCP client. You sign in once with OAuth and approve only what the agent needs. There is no API Key to
                paste.
              </p>
              <div className={styles.install}>
                <code>{installCommand}</code>
                <CopyButton text={installCommand} />
              </div>
              <Link className={styles.cta} to="/docs/$" params={{ _splat: "mcp" }}>
                Connect an agent
                <ArrowIcon />
              </Link>
            </div>
            <div>
              <h3>REST API</h3>
              <p>
                Anything that can send an HTTP request can save to your queue with the{" "}
                <Link to="/docs/$" params={{ _splat: "" }}>Sleevy bookmark manager API</Link>: a script, a CLI tool, or an
                automation. JSON over HTTPS, with scoped API Keys and an OpenAPI 3.1 schema.
              </p>
              <Link className={styles.cta} to="/docs/$" params={{ _splat: "getting-started" }}>
                Read the API docs
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}
