// PROTOTYPE — throwaway. "Agent": show it, do not list it. Example prompts on
// the left play as conversations in Claude and ChatGPT on the right; the REST
// API is the quieter second way in under the prompts.

import { useRef } from "react"
import { Link } from "@tanstack/react-router"
import clsx from "clsx"

import {
  ChatWindow,
  ClientAvatar,
  ConversationSlides,
  conversations,
  durationOf,
  useConversationPlayer,
} from "./agent-conversations"
import { ArrowIcon, CopyButton, mcpSnippet } from "./extend-snippets"
import styles from "./variant-agent.module.scss"

export function VariantAgent() {
  const sectionRef = useRef<HTMLElement>(null)
  const { active, step, direction, playing, select } = useConversationPlayer(sectionRef)
  const conversation = conversations[active]

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="extend-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <h2 className={styles.statement} id="extend-title">
            Built to extend. <span>Ask Claude, ChatGPT, or any MCP client to work your queue.</span>
          </h2>

          <ol className={styles.prompts} aria-label="Things to ask your agent">
            {conversations.map((candidate, index) => (
              <li key={candidate.prompt}>
                <button
                  type="button"
                  className={clsx(styles.prompt, index === active && styles.promptActive)}
                  aria-current={index === active}
                  onClick={() => select(index)}
                >
                  <ClientAvatar client={candidate.client} className={styles.promptAvatar} />“{candidate.prompt}”
                  {index === active && (
                    <span
                      className={styles.progress}
                      style={{
                        animationDuration: `${durationOf(candidate)}ms`,
                        animationPlayState: playing ? "running" : "paused",
                      }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ol>

          <div className={styles.install}>
            <code>
              <span>npx</span> add-mcp https://api.sleevy.app/mcp --name sleevy
            </code>
            <CopyButton snippet={mcpSnippet} />
          </div>

          <div className={styles.links}>
            <Link to="/docs/$" params={{ _splat: "mcp" }}>
              Connect an agent
              <ArrowIcon />
            </Link>
            <Link to="/docs/$" params={{ _splat: "getting-started" }}>
              Or script it with the REST API
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <ChatWindow client={conversation.client} className={styles.window}>
          <ConversationSlides active={active} step={step} direction={direction} />
        </ChatWindow>
      </div>
    </section>
  )
}
