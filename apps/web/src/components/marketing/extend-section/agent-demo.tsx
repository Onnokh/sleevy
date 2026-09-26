import { type CSSProperties, type RefObject, useEffect, useState } from "react"
import clsx from "clsx"
import { Folder as FolderIcon, Inbox as InboxIcon } from "lucide-react"
import { AnimatePresence, m, type Transition } from "motion/react"

import {
  type Client,
  type Conversation,
  conversations,
  type LinkPreview,
  type PaneRow,
  type PaneState,
  paneAt,
  type RowMark,
  stepsOf,
} from "./agent-demo-script"
import { ClaudeMark, OpenAIMark } from "./client-marks"
import styles from "./agent-demo.module.scss"

const clients = {
  claude: { name: "Claude", Mark: ClaudeMark },
  chatgpt: { name: "ChatGPT", Mark: OpenAIMark },
} as const

const FIRST_STEP = 700
const STEP = 900
const HOLD = 3800

/**
 * Plays the conversations one after another while `host` is on screen, and
 * stops while it is not. With reduced motion a conversation shows complete
 * and nothing advances on its own.
 */
export function useConversationPlayer(host: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(0)
  const [step, setStep] = useState(0)
  // 1 slides the next conversation in from the right, -1 from the left.
  const [direction, setDirection] = useState(1)
  const [visible, setVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const total = stepsOf(conversations[active])

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    const element = host.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [host])

  useEffect(() => {
    if (reduceMotion) {
      setStep(total)
      return
    }
    if (!visible) return
    const delay = step === 0 ? FIRST_STEP : step < total ? STEP : HOLD
    const timer = window.setTimeout(() => {
      if (step < total) {
        setStep(step + 1)
      } else {
        setDirection(1)
        setActive((active + 1) % conversations.length)
        setStep(0)
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [active, step, total, visible, reduceMotion])

  const select = (index: number) => {
    setDirection(index >= active ? 1 : -1)
    setActive(index)
    setStep(reduceMotion ? stepsOf(conversations[index]) : 0)
  }

  return { active, step, direction, select }
}

const settle: Transition = { type: "spring", stiffness: 420, damping: 34 }
const glide: Transition = { type: "spring", stiffness: 240, damping: 30 }

// The favicon service the Web Companion's rows use (saved-card.tsx), copied
// so this bundle does not pull in the app's card and its hooks.
const faviconUrl = (host: string) =>
  `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${host}&size=64`

/**
 * A saved item as the Web Companion's Inbox draws it (saved-card): favicon,
 * title over host, and the date with the Unread Dot before it.
 */
function SavedRow({
  link,
  mark,
  className,
  style,
}: {
  link: LinkPreview
  mark?: RowMark
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={clsx(styles.row, mark && styles[mark], className)} style={style}>
      <img className={styles.favicon} src={faviconUrl(link.host)} alt="" width={28} height={28} loading="lazy" />
      <span className={styles.body}>
        <span className={styles.title}>{link.title}</span>
        <span className={styles.host}>{link.host}</span>
      </span>
      {link.date && <span className={clsx(styles.date, link.unread && styles.unreadDate)}>{link.date}</span>}
    </span>
  )
}

function ClientAvatar({ client }: { client: Client }) {
  const { Mark } = clients[client]
  return (
    <span className={clsx(styles.avatar, styles[client])}>
      <Mark />
    </span>
  )
}

/** The chat: the request, the connector at work, then the reply. */
function ConversationThread({ conversation, step }: { conversation: Conversation; step: number }) {
  const total = stepsOf(conversation)
  return (
    <>
      {/* The request arrives with its conversation, so it has no motion of its own. */}
      <div className={styles.user}>
        <p>{conversation.user}</p>
        {conversation.attachment && <SavedRow link={conversation.attachment} className={styles.attachment} />}
      </div>

      {step >= 1 && (
        <div className={styles.calls}>
          {conversation.calls.map((call, index) => {
            if (step < index + 1) return null
            const done = step >= index + 2
            return (
              // One plain line with the app icon, the way the clients show a
              // connector at work, not a tool name and its arguments.
              <m.div
                key={call.tool + index}
                className={styles.call}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={settle}
              >
                <img className={styles.sleevyIcon} src="/app-icon-160.webp" alt="" width={160} height={160} />
                {/* "Saving…" rolls up and away as "Saved" rolls in under it. */}
                <span className={styles.callRoll}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span
                      key={done ? "done" : "running"}
                      className={clsx(styles.callText, !done && styles.running)}
                      initial={{ opacity: 0, y: "0.9em" }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: "-0.9em" }}
                      transition={settle}
                    >
                      {done ? call.done : `${call.running}…`}
                    </m.span>
                  </AnimatePresence>
                </span>
                <svg className={styles.chevron} viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </m.div>
            )
          })}
        </div>
      )}

      {step >= total && (
        <m.div className={styles.reply} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={settle}>
          <ClientAvatar client={conversation.client} />
          <div>
            <p>{conversation.reply}</p>
            {conversation.found && (
              <m.span
                className={styles.foundWrap}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...settle, delay: 0.15 }}
              >
                <SavedRow link={conversation.found} className={styles.found} />
              </m.span>
            )}
          </div>
        </m.div>
      )}
    </>
  )
}

const slide = {
  enter: (direction: number) => ({ x: `${direction * 35}%`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: `${direction * -35}%`, opacity: 0 }),
}

/* Opening a Folder slides the pane in from the right; back to the Inbox, in
   from the left. */
const navigate = {
  enter: (view: PaneState["view"]) => ({ x: view === "folder" ? "40%" : "-40%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (view: PaneState["view"]) => ({ x: view === "folder" ? "-40%" : "40%", opacity: 0 }),
}

/** When the drop of moved rows into an opened Folder starts, and the gap between them. */
const ARRIVE_DELAY = 0.35
const ARRIVE_STAGGER = 0.14

function PaneItem({ row }: { row: PaneRow }) {
  const arriveDelay = row.arriving === undefined ? undefined : ARRIVE_DELAY + row.arriving * ARRIVE_STAGGER
  return (
    <m.li
      className={styles.paneItem}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={arriveDelay === undefined ? glide : { ...glide, delay: arriveDelay }}
    >
      {/* A moved row lands with the soft fill, which then fades, so the
          Folder settles to how the app shows it. */}
      <SavedRow
        link={row}
        mark={row.mark}
        className={clsx(arriveDelay !== undefined && styles.arrived)}
        style={arriveDelay === undefined ? undefined : ({ "--arrive-delay": `${arriveDelay}s` } as CSSProperties)}
      />
    </m.li>
  )
}

/** A simplified Web Companion: the page title and count, then the rows. */
function AppPane({ state }: { state: PaneState }) {
  return (
    <div className={styles.pane}>
      <AnimatePresence initial={false} custom={state.view}>
        <m.div
          key={state.view}
          className={styles.paneView}
          custom={state.view}
          variants={navigate}
          initial="enter"
          animate="center"
          exit="exit"
          transition={glide}
        >
          <div className={styles.paneHead}>
            <p className={styles.paneTitle}>
              {state.view === "folder" ? <FolderIcon size={18} strokeWidth={1.75} /> : <InboxIcon size={18} strokeWidth={1.75} />}
              {state.title}
            </p>
            <p className={styles.paneSubtitle}>{state.subtitle}</p>
          </div>
          <ul className={styles.paneRows}>
            {/* Moved rows drop into the Folder one after another once it has
                opened. Their own group, because it must animate on its first
                render, where the other rows must not. */}
            <AnimatePresence>
              {state.rows
                .filter((row) => row.arriving !== undefined)
                .map((row) => (
                  <PaneItem key={row.id} row={row} />
                ))}
            </AnimatePresence>
            {/* A new saved item opens its row and pushes the list down; a read
                one closes its row and leaves. */}
            <AnimatePresence initial={false}>
              {state.rows
                .filter((row) => row.arriving === undefined)
                .map((row) => (
                  <PaneItem key={row.id} row={row} />
                ))}
            </AnimatePresence>
          </ul>
        </m.div>
      </AnimatePresence>
    </div>
  )
}

function Composer({ client }: { client: Client }) {
  return (
    <div className={styles.composer}>
      <span>Reply to {clients[client].name}…</span>
      <i className={styles.send}>
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </i>
    </div>
  )
}

/**
 * The agent at work: a chat in Claude or ChatGPT on the left, and the Web
 * Companion on the right changing as the agent works. Decoration for the
 * section's own copy, so it is hidden from assistive technology.
 */
export function AgentDemo({
  active,
  step,
  direction,
  className,
}: {
  active: number
  step: number
  direction: number
  className?: string
}) {
  const { client } = conversations[active]
  const { name, Mark } = clients[client]
  return (
    <div className={clsx(styles.window, className)} aria-hidden="true">
      <div className={styles.windowBar}>
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={client}
            className={styles.client}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Mark className={clsx(styles.clientMark, styles[client])} />
            {name}
          </m.span>
        </AnimatePresence>
      </div>
      <div className={styles.panes}>
        <div className={styles.chat}>
          {/* A new conversation slides in from the side it comes from while
              the old one slides out the other way. */}
          <div className={styles.slides}>
            <AnimatePresence initial={false} custom={direction}>
              <m.div
                key={active}
                className={styles.thread}
                custom={direction}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={glide}
              >
                <ConversationThread conversation={conversations[active]} step={step} />
              </m.div>
            </AnimatePresence>
          </div>
          <Composer client={client} />
        </div>
        <AppPane state={paneAt(active, step)} />
      </div>
    </div>
  )
}
