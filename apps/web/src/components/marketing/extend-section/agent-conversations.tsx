// PROTOTYPE — throwaway. Example agent conversations over the Sleevy MCP
// server, a player that steps through them, and the chat window that shows
// one. Each step is a real tool from McpTools.ts (list_saved_items takes no
// search term, so "find" is the agent reading the list itself), shown the way
// Claude and ChatGPT show a connector at work: one plain line, not a payload.

import { useEffect, useState, type RefObject } from "react"
import clsx from "clsx"
import { Folder as FolderIcon, Inbox as InboxIcon } from "lucide-react"
import { AnimatePresence, m, type Transition } from "motion/react"

import { ClaudeMark, OpenAIMark } from "./agent-logos"
import styles from "./agent-conversations.module.scss"

/** One tool call: the real tool, and what the client says while and after it runs. */
type Call = { readonly tool: string; readonly running: string; readonly done: string }
type LinkPreview = { readonly title: string; readonly host: string; readonly date?: string; readonly unread?: boolean }

export const clients = {
  claude: { name: "Claude", Mark: ClaudeMark },
  chatgpt: { name: "ChatGPT", Mark: OpenAIMark },
} as const
export type Client = keyof typeof clients

export type Conversation = {
  readonly client: Client
  readonly prompt: string
  readonly user: string
  readonly attachment?: LinkPreview
  readonly calls: readonly Call[]
  readonly reply: string
  readonly found?: LinkPreview
}

export const conversations: readonly Conversation[] = [
  {
    client: "claude",
    prompt: "Save this for later",
    user: "Save this for later.",
    attachment: { title: "Use The Index, Luke", host: "use-the-index-luke.com" },
    calls: [{ tool: "save_link", running: "Saving to Sleevy", done: "Saved to Sleevy" }],
    reply: "Saved. It is at the top of your Inbox, and on your iPhone too.",
  },
  {
    client: "chatgpt",
    prompt: "Find the article about container queries",
    user: "Find the article about container queries I saved last month.",
    calls: [{ tool: "list_saved_items", running: "Looking through your saved items", done: "Looked through 100 saved items" }],
    reply: "This one? You saved it on 24 August and have not read it yet.",
    found: { title: "A Primer On CSS Container Queries", host: "smashingmagazine.com", date: "Aug 24", unread: true },
  },
  {
    client: "claude",
    prompt: "Put my database links in a folder",
    user: "Put everything I saved about databases in my Databases folder.",
    calls: [
      { tool: "list_folders", running: "Checking your folders", done: "Checked your folders" },
      { tool: "list_saved_items", running: "Looking through your saved items", done: "Found 3 about databases" },
      { tool: "set_saved_item_folder", running: "Moving 3 saved items", done: "Moved 3 saved items to Databases" },
    ],
    reply: "Done. All three are in Databases now.",
  },
  {
    client: "chatgpt",
    prompt: "Mark it read",
    user: "I finished the container queries one. Mark it read.",
    calls: [{ tool: "set_saved_item_read_state", running: "Marking it read", done: "Marked it read" }],
    reply: "Marked read. It stays in your Library if you want it again.",
  },
]

/** Steps in one conversation: the question, each call running then done, the reply. */
export const stepsOf = (conversation: Conversation) => conversation.calls.length + 2

const FIRST_STEP = 700
const STEP = 900
const HOLD = 3800

/** How long one conversation plays, for progress bars. */
export const durationOf = (conversation: Conversation) => FIRST_STEP + STEP * (stepsOf(conversation) - 1) + HOLD

/**
 * Plays the conversations one after another while `host` is on screen. With
 * reduced motion every conversation shows complete and nothing advances.
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

  return { active, step, total, direction, playing: visible && !reduceMotion, select }
}

// The favicon service the Web Companion's rows use (saved-card.tsx), copied
// so the marketing bundle does not pull in the app's card and its hooks.
const faviconUrl = (host: string) =>
  `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${host}&size=64`

/**
 * A saved item as the Web Companion's Inbox draws it (saved-card): favicon,
 * title over host, and the date with the Unread Dot before it.
 */
function SavedRow({ link, selected, className }: { link: LinkPreview; selected?: boolean; className?: string }) {
  return (
    <span className={clsx(styles.row, selected && styles.selected, className)}>
      <img className={styles.favicon} src={faviconUrl(link.host)} alt="" width={28} height={28} loading="lazy" />
      <span className={styles.body}>
        <span className={styles.title}>{link.title}</span>
        <span className={styles.host}>{link.host}</span>
      </span>
      {link.date && <span className={clsx(styles.date, link.unread && styles.unreadDate)}>{link.date}</span>}
    </span>
  )
}

function SleevyIcon({ className }: { className?: string }) {
  return <img className={clsx(styles.sleevyIcon, className)} src="/app-icon-160.webp" alt="" width={160} height={160} />
}

const settle: Transition = { type: "spring", stiffness: 420, damping: 34 }
const glide: Transition = { type: "spring", stiffness: 240, damping: 30 }

/** The chat: the question, the connector at work, then the reply. */
function ConversationThread({ conversation, step }: { conversation: Conversation; step: number }) {
  const total = stepsOf(conversation)
  return (
    <>
      {/* The question arrives with its conversation, so it has no motion of its own. */}
      <div className={styles.user}>
        <p>{conversation.user}</p>
        {conversation.attachment && <SavedRow link={conversation.attachment} className={styles.attachment} />}
      </div>

      {conversation.calls.some((_, index) => step >= index + 1) && (
        <div className={styles.calls}>
          {conversation.calls.map((call, index) => {
            if (step < index + 1) return null
            const done = step >= index + 2
            return (
              <m.div
                key={call.tool + index}
                className={styles.call}
                title={call.tool}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={settle}
              >
                <SleevyIcon />
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
                <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

/**
 * The active conversation. A new one slides in from the side it comes from
 * while the old one slides out the other way.
 */
export function ConversationSlides({ active, step, direction }: { active: number; step: number; direction: number }) {
  return (
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
  )
}

export function ClientAvatar({ client, className }: { client: Client; className?: string }) {
  const { Mark } = clients[client]
  return (
    <span className={clsx(styles.avatar, styles[client], className)}>
      <Mark />
    </span>
  )
}

/** Window chrome around a thread: only the client it runs in. */
export function ChatWindow({
  client,
  children,
  className,
  composer = true,
}: {
  client: Client
  children: React.ReactNode
  className?: string
  composer?: boolean
}) {
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
      {children}
      {composer && <Composer client={client} />}
    </div>
  )
}

/** The client's message box, empty; it is there so the window reads as a chat. */
export function Composer({ client }: { client: Client }) {
  return (
    <div className={styles.composer}>
      <span className={styles.placeholder}>Reply to {clients[client].name}…</span>
      <i className={styles.send}>
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </i>
    </div>
  )
}

/* The app pane a stage shows beside the chat, and what each conversation has
   done to it by a given step. Real pages, so the favicons are real. The Inbox
   holds unread Saved Items only: marking one read takes it out. A Folder move
   leaves the rows in the Inbox (its rows do not show Folders), so the pane
   opens the Folder instead, the way a click on it in the sidebar would. */
type AppItem = LinkPreview & { readonly id: string; readonly database?: boolean }

const inboxItems: readonly AppItem[] = [
  { id: "luke", title: "Use The Index, Luke", host: "use-the-index-luke.com", date: "now", database: true },
  { id: "vercel", title: "Vercel Security Dashboard is now generally available", host: "vercel.com", date: "12h" },
  { id: "explain", title: "Using EXPLAIN", host: "postgresql.org", date: "15h", database: true },
  { id: "oxlint", title: "eslint/complexity | Oxlint", host: "oxc.rs", date: "Aug 26" },
  { id: "container", title: "A Primer On CSS Container Queries", host: "smashingmagazine.com", date: "Aug 24" },
  { id: "vacuum", title: "Routine Vacuuming", host: "postgresql.org", date: "Aug 21", database: true },
  { id: "tanstack", title: "Inside a TanStack Router Navigation | TanStack Blog", host: "tanstack.com", date: "Aug 15" },
]

/** Already in Databases, and read, before the agent moves anything. */
const databaseItems: readonly AppItem[] = [
  { id: "sqlite", title: "SQLite is not a toy database", host: "antonz.org", date: "Jul 12" },
  { id: "discord", title: "How Discord Stores Trillions of Messages", host: "discord.com", date: "Jun 3" },
]

/** The unread Saved Items past the ones the stage has room to show. */
const UNSEEN_UNREAD = 17

type PaneRow = AppItem & { readonly selected: boolean; readonly arriving?: number }
export type PaneState = {
  readonly view: "inbox" | "folder"
  readonly title: string
  readonly subtitle: string
  readonly rows: readonly PaneRow[]
}

export function paneAt(active: number, step: number): PaneState {
  if (active === 2 && step >= 4) {
    const moved = inboxItems.filter((item) => item.database)
    const rows: PaneRow[] = [
      ...moved.map((item, index) => ({ ...item, unread: true, selected: true, arriving: index })),
      ...databaseItems.map((item) => ({ ...item, unread: false, selected: false })),
    ]
    return { view: "folder", title: "Databases", subtitle: `${rows.length} saves · ${moved.length} unread`, rows }
  }

  const saved = active > 0 || step >= 2
  const read = active === 3 && step >= 2
  const selected = (item: AppItem) =>
    (active === 0 && step >= 2 && item.id === "luke") ||
    (active === 1 && step >= 2 && item.id === "container") ||
    (active === 2 && step === 3 && !!item.database) ||
    (active === 3 && step === 1 && item.id === "container")

  const rows = inboxItems
    .filter((item) => (saved || item.id !== "luke") && (!read || item.id !== "container"))
    .map((item) => ({ ...item, unread: true, selected: selected(item) }))
  return { view: "inbox", title: "Inbox", subtitle: `${rows.length + UNSEEN_UNREAD} unread`, rows }
}

/* Opening a Folder slides the pane in from the right; back to the Inbox, in
   from the left. */
const navigate = {
  enter: (view: PaneState["view"]) => ({ x: view === "folder" ? "40%" : "-40%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (view: PaneState["view"]) => ({ x: view === "folder" ? "-40%" : "40%", opacity: 0 }),
}

function PaneItem({ row, transition }: { row: PaneRow; transition: Transition }) {
  return (
    <m.li
      className={styles.paneItem}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={transition}
    >
      <SavedRow link={row} selected={row.selected} />
    </m.li>
  )
}

/** A simplified Web Companion: the page title and count, then the rows. */
export function AppPane({ state }: { state: PaneState }) {
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
            <h4>
              {state.view === "folder" ? <FolderIcon size={18} strokeWidth={1.75} /> : <InboxIcon size={18} strokeWidth={1.75} />}
              {state.title}
            </h4>
            <p>{state.subtitle}</p>
          </div>
          <ul className={styles.paneRows}>
            {/* Moved rows drop into the Folder one after another once it has
                opened. Their own group, because it must animate on its first
                render, where the other rows must not. */}
            <AnimatePresence>
              {state.rows.filter((row) => row.arriving !== undefined).map((row) => (
                <PaneItem key={row.id} row={row} transition={{ ...glide, delay: 0.35 + (row.arriving ?? 0) * 0.14 }} />
              ))}
            </AnimatePresence>
            {/* A new saved item opens its row and pushes the list down; a read
                one closes its row and leaves. */}
            <AnimatePresence initial={false}>
              {state.rows.filter((row) => row.arriving === undefined).map((row) => (
                <PaneItem key={row.id} row={row} transition={glide} />
              ))}
            </AnimatePresence>
          </ul>
        </m.div>
      </AnimatePresence>
    </div>
  )
}
