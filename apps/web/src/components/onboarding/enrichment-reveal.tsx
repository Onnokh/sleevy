import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { AnimatePresence, m, type Transition } from "motion/react"
import { Check, FileText, FolderGit2, Globe, MessageSquare, Play, Sparkles } from "lucide-react"
import type { LinkType, Topic } from "@sleevy/contract"

import { faviconUrl } from "../saved-card/saved-card"
import type { SavedItem } from "../../sleevy/saved-items"
import styles from "./enrichment-reveal.module.scss"

/**
 * The first Saved Item, shown large while Sleevy works on it: the page is
 * fetched, read, then summarized and tagged.
 *
 * The stages are a timed reveal of real data, not a report on the Enrichment
 * Job. Clients only see a coarse Enrichment Status, so a stage is chosen from
 * the fields the Saved Item has, and each stays up long enough to be seen.
 * That matters because Enrichment is shared per Link: a popular link, or one
 * saved before, can arrive already enriched, and would otherwise flash past.
 *
 * The card keeps one shape from the first frame. Every field has its place
 * before its value arrives, so a stage only crossfades content in place; the
 * one change of size is the fold into the Inbox row at the end.
 */
type Stage = "fetching" | "reading" | "summarizing" | "done"

const STAGE_ORDER: readonly Stage[] = ["fetching", "reading", "summarizing", "done"]

/// How long a stage stays up at least, even when the data is already there.
const MIN_STAGE_MS: Record<Exclude<Stage, "done">, number> = {
  fetching: 1000,
  reading: 1300,
  summarizing: 900,
}

/// How long the finished card stays before it folds into a normal row, and
/// how long the fold takes.
const DONE_HOLD_MS = 2400
const FOLD_MS = 600

/// When enrichment takes longer than this, the reveal stops waiting. The row
/// still gains its summary later, the way every other row does.
const GIVE_UP_MS = 20_000

/// How far the progress line along the card has run at each stage. It never
/// stands still at zero, so a slow fetch still reads as work in progress.
const PROGRESS: Record<Stage, number> = {
  fetching: 0.22,
  reading: 0.55,
  summarizing: 0.85,
  done: 1,
}

const TYPE_LABELS: Record<LinkType, string> = {
  article: "Article",
  video: "Video",
  website: "Website",
  repository: "Repository",
  post: "Post",
}

const TYPE_ICONS: Record<LinkType, typeof Globe> = {
  article: FileText,
  video: Play,
  website: Globe,
  repository: FolderGit2,
  post: MessageSquare,
}

const TAG_LABELS: Record<Topic, string> = {
  ai: "AI",
  tools: "Tools",
  typescript: "TypeScript",
  security: "Security",
  design: "Design",
  backend: "Backend",
  "front-end": "Front-end",
}

// One easing for everything that moves, so the pieces arrive as one motion.
const EASE = [0.2, 0, 0, 1] as const
const spring: Transition = { type: "spring", duration: 0.5, bounce: 0 }

/// Content arriving in the place its placeholder held. Opacity and a short
/// rise only: they stay on the compositor, where blur would repaint.
const fade = {
  initial: { opacity: 0, y: 3 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.2, ease: "easeOut" } },
  transition: { duration: 0.45, ease: EASE },
} as const

const iconSwap = {
  initial: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
  transition: { type: "spring", duration: 0.3, bounce: 0 },
} as const

/// The furthest stage the data allows: a title means the page was fetched,
/// and a finished Enrichment Status means there is nothing left to wait for.
const stageOfData = (item: SavedItem): Stage => {
  if (item.enrichmentStatus !== "pending") return "done"
  return item.title ? "reading" : "fetching"
}

const hasSummaryOrTags = (item: SavedItem) => Boolean(item.previewSummary) || item.tags.length > 0

const nextStage = (stage: Stage, item: SavedItem): Stage => {
  const reachable = STAGE_ORDER.indexOf(stageOfData(item))
  if (stage === "fetching" && reachable >= 1) return "reading"
  // Straight to done when there is no summary and no Tag to show: a failed or
  // thin Enrichment ends quietly on "Saved" rather than on an empty stage.
  if (stage === "reading" && reachable === 3) return hasSummaryOrTags(item) ? "summarizing" : "done"
  if (stage === "summarizing") return "done"
  return stage
}

const statusLabel = (stage: Stage, item: SavedItem) => {
  switch (stage) {
    case "fetching": return "Fetching the page"
    case "reading": return "Reading it"
    case "summarizing": return "Writing a summary and adding tags"
    case "done": return hasSummaryOrTags(item) ? "Summarized and tagged for you" : "Saved"
  }
}

const WORD_STAGGER = 0.03

/// The height of what a box holds, kept current as it changes, so the box can
/// animate to it: a summary of any length opens its room instead of jumping.
function useContentHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setHeight(element.offsetHeight)
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, height] as const
}

/// The Preview Summary, word by word: each word settles in a moment after the
/// one before it, the way the summary reads rather than the way it types.
function Summary({ text }: { readonly text: string }) {
  const words = text.split(" ")
  return (
    <m.p
      className={styles.summary}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      variants={{ visible: { transition: { staggerChildren: WORD_STAGGER } } }}
    >
      {words.map((word, index) => (
        <m.span
          // Words repeat, so the position is part of the key.
          key={`${index}:${word}`}
          className={styles.word}
          variants={{ hidden: { opacity: 0, y: 3 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          {index < words.length - 1 ? `${word} ` : word}
        </m.span>
      ))}
    </m.p>
  )
}

export function EnrichmentReveal({ item, onSettled }: {
  readonly item: SavedItem
  readonly onSettled: () => void
}) {
  const [stage, setStage] = useState<Stage>("fetching")
  const [folding, setFolding] = useState(false)
  const [gaveUp, setGaveUp] = useState(false)
  const enteredAtRef = useRef(Date.now())
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  const summary = item.previewSummary ?? ""
  const wordCount = summary ? summary.split(" ").length : 0
  const [detailsRef, detailsHeight] = useContentHeight<HTMLDivElement>()

  useEffect(() => {
    const timer = window.setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (folding) {
      const timer = window.setTimeout(() => onSettledRef.current(), FOLD_MS)
      return () => window.clearTimeout(timer)
    }
    if (stage === "done") {
      const timer = window.setTimeout(() => setFolding(true), DONE_HOLD_MS)
      return () => window.clearTimeout(timer)
    }

    const next = gaveUp ? "done" : nextStage(stage, item)
    if (next === stage) return

    // The words have to finish arriving before the summary stage counts as seen.
    const minimum = stage === "summarizing"
      ? MIN_STAGE_MS.summarizing + wordCount * WORD_STAGGER * 1000
      : MIN_STAGE_MS[stage]
    const remaining = Math.max(0, minimum - (Date.now() - enteredAtRef.current))
    const timer = window.setTimeout(() => {
      enteredAtRef.current = Date.now()
      setStage(next)
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [stage, folding, item, gaveUp, wordCount])

  const fetched = stage !== "fetching"
  const summarized = stage === "summarizing" || stage === "done"
  // The summary and Tags keep their place while there may be something to put
  // in it, and give it back when there is not, or when the card folds.
  const keepsDetails = !folding && (stage !== "done" || hasSummaryOrTags(item))
  // The image comes with the title, so a fetched page with no image has none
  // on the way, and an empty frame would only stand for nothing.
  const keepsImage = !folding && !(fetched && !item.imageUrl)
  const TypeIcon = TYPE_ICONS[item.type]
  const label = statusLabel(stage, item)
  const fold = { duration: FOLD_MS / 1000, ease: EASE }

  return (
    <div className={styles.reveal}>
      <m.div
        // Shared with the capture field it was typed into, so the field grows
        // into this card instead of being swapped for it. Measured once, on
        // arrival: from then on every change of size is animated explicitly.
        layoutId="first-save"
        layoutDependency={0}
        className={styles.card}
        data-folding={folding || undefined}
        style={{ borderRadius: 16 }}
        // The row it folds into has the smaller corner of every Inbox row.
        animate={{ borderRadius: folding ? 8 : 16 }}
        transition={{ layout: spring, borderRadius: fold }}
      >
        <img className={styles.favicon} src={faviconUrl(item.host)} alt="" width={28} height={28} />

        <div className={styles.body}>
          <div className={styles.titleStack}>
            <AnimatePresence initial={false}>
              {fetched ? (
                <m.span key="title" className={styles.title} {...fade}>{item.title ?? item.host}</m.span>
              ) : (
                <m.span key="bar" className={styles.titleBar} {...fade} />
              )}
            </AnimatePresence>
          </div>

          <span className={styles.meta}>
            {item.host}
            <AnimatePresence initial={false}>
              {fetched ? (
                <m.span key="type" className={styles.type} {...fade}>
                  <span aria-hidden="true">·</span>
                  <TypeIcon size={13} strokeWidth={1.75} aria-hidden="true" />
                  {TYPE_LABELS[item.type]}
                </m.span>
              ) : null}
            </AnimatePresence>
          </span>

          <m.div
            className={styles.details}
            initial={false}
            animate={keepsDetails ? { height: detailsHeight ?? "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            transition={fold}
          >
            <div ref={detailsRef}>
            <div className={styles.stack}>
              <AnimatePresence initial={false}>
                {summarized && summary ? (
                  <Summary key="summary" text={summary} />
                ) : (
                  <m.span key="summary-bars" className={styles.summaryBars} {...fade}>
                    <span className={styles.bar} />
                    <span className={styles.bar} />
                  </m.span>
                )}
              </AnimatePresence>
            </div>

            <ul className={styles.tags} aria-label={summarized && item.tags.length > 0 ? "Tags" : undefined}>
              {summarized ? item.tags.map((tag, index) => (
                <m.li
                  key={tag}
                  className={styles.tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...spring, delay: wordCount * WORD_STAGGER + index * 0.08 }}
                >
                  {TAG_LABELS[tag]}
                </m.li>
              )) : null}
            </ul>
            </div>
          </m.div>
        </div>

        <m.div
          className={styles.imageSlot}
          initial={false}
          animate={keepsImage ? { width: 168, height: 110, opacity: 1 } : { width: 0, height: 0, opacity: 0 }}
          transition={fold}
        >
          <div className={styles.stack}>
            <AnimatePresence initial={false}>
              {item.imageUrl && fetched ? (
                <m.img
                  key="image"
                  className={styles.image}
                  src={item.imageUrl}
                  alt=""
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              ) : (
                <m.span key="placeholder" className={styles.imagePlaceholder} {...fade} />
              )}
            </AnimatePresence>
          </div>
        </m.div>

        <AnimatePresence>
          {folding ? (
            <m.span
              key="date"
              className={styles.date}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              now
            </m.span>
          ) : null}
        </AnimatePresence>

        <m.span
          className={styles.progress}
          aria-hidden="true"
          initial={{ scaleX: 0.04 }}
          animate={{ scaleX: PROGRESS[stage], opacity: stage === "done" ? 0 : 1 }}
          transition={{
            scaleX: { duration: 1.2, ease: EASE },
            opacity: { duration: 0.5, delay: 0.6 },
          }}
        />
      </m.div>

      <m.div
        className={styles.statusSlot}
        initial={false}
        animate={folding ? { height: 0, opacity: 0 } : { height: "auto", opacity: 1 }}
        transition={fold}
      >
        <div className={styles.status} aria-live="polite">
          <span className={styles.statusIcon}>
            <AnimatePresence initial={false} mode="popLayout">
              {stage === "done" ? (
                <m.span key="check" {...iconSwap}><Check size={15} strokeWidth={2.2} aria-hidden="true" /></m.span>
              ) : (
                <m.span key="working" {...iconSwap}>
                  <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" className={styles.working} />
                </m.span>
              )}
            </AnimatePresence>
          </span>
          <span className={styles.stack}>
            <AnimatePresence initial={false}>
              <m.span
                key={label}
                className={styles.statusLabel}
                data-done={stage === "done" || undefined}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
                transition={spring}
              >
                {label}
              </m.span>
            </AnimatePresence>
          </span>
        </div>
      </m.div>
    </div>
  )
}
