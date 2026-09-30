import * as Dialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import { Check, Folder, FolderPlus, ListChecks, Minus, ScanSearch, X } from "lucide-react"
import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig } from "motion/react"
import { type CSSProperties, type ReactNode, useMemo, useState } from "react"

import { folderErrorMessage, useFolders } from "../../sleevy/folders"
import {
  type OrganizePlan,
  useApplyOrganize,
  useDiscardOrganize,
  useOrganizeRun,
  useStartOrganize,
} from "../../sleevy/organize"
import { colorSwatches } from "../folders/folder-dialog"
import type { FolderCardColor } from "../folders/folder-card-shader"
import { faviconUrl } from "../saved-card/saved-card"
import { Button } from "../ui/button/button"
import styles from "./organize-wizard.module.scss"

type Move = OrganizePlan["moves"][number]

type Group = {
  readonly id: string
  readonly name: string
  readonly emoji: string | null
  readonly color: string | null
  /** The proposed Folder's key, or null for a Folder the person already has. */
  readonly newFolderKey: string | null
  readonly moves: readonly Move[]
}

type Step = "start" | "scan" | "folders" | "review" | "done"

const ORDER: readonly Step[] = ["start", "scan", "folders", "review", "done"]

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** The plan's moves, one group per target Folder: existing Folders first, then the new ones. */
function groupMoves(
  plan: OrganizePlan,
  folders: readonly { id: string; name: string; emoji: string | null; color: string | null }[],
): Group[] {
  const existing = new Map(folders.map((folder) => [folder.id, folder]))
  const groups = new Map<string, { group: Group; moves: Move[] }>()
  for (const move of plan.moves) {
    const id = move.folderId ?? `new:${move.newFolderKey}`
    let entry = groups.get(id)
    if (!entry) {
      const folder = move.folderId ? existing.get(move.folderId) : undefined
      const proposed = move.newFolderKey ? plan.newFolders.find((candidate) => candidate.key === move.newFolderKey) : undefined
      // A Folder deleted since the plan was made has nowhere to go.
      if (!folder && !proposed) continue
      const moves: Move[] = []
      entry = {
        moves,
        group: {
          id,
          name: folder?.name ?? proposed!.name,
          emoji: folder?.emoji ?? proposed?.emoji ?? null,
          color: folder?.color ?? proposed?.color ?? null,
          newFolderKey: folder ? null : proposed!.key,
          moves,
        },
      }
      groups.set(id, entry)
    }
    entry.moves.push(move)
  }
  return [...groups.values()]
    .map(({ group }) => group)
    .sort((left, right) => Number(left.newFolderKey !== null) - Number(right.newFolderKey !== null))
}

const swatch = (color: string | null) =>
  color && color in colorSwatches ? colorSwatches[color as FolderCardColor] : colorSwatches.neutral

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** A round check that stands in for the browser checkbox; the real input stays for keyboard and screen readers. */
function Tick({ state }: { readonly state: "on" | "off" | "some" }) {
  return (
    <span className={clsx(styles.tick, state !== "off" && styles.tickOn)} aria-hidden>
      {state === "on" ? <Check size={12} strokeWidth={3} /> : state === "some" ? <Minus size={12} strokeWidth={3} /> : null}
    </span>
  )
}

function FolderTile({ emoji, color, size = "md" }: { readonly emoji: string | null; readonly color: string | null; readonly size?: "md" | "lg" }) {
  return (
    <span
      className={clsx(styles.folderTile, size === "lg" && styles.folderTileLarge)}
      style={{ "--folder-swatch": swatch(color) } as CSSProperties}
      aria-hidden
    >
      {emoji ?? <Folder size={size === "lg" ? 18 : 15} strokeWidth={2} />}
    </span>
  )
}

/**
 * Organize as a guided overlay: scan the unfiled saves, keep or drop the new
 * Folders it suggests, review each move, then apply. The run itself lives on
 * the server, so closing the overlay mid-scan or mid-review loses nothing;
 * opening it again picks up at the same step.
 */
export function OrganizeWizard({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const run = useOrganizeRun()
  const start = useStartOrganize()
  const discard = useDiscardOrganize()
  const apply = useApplyOrganize()
  const folders = useFolders()

  const [droppedFolders, setDroppedFolders] = useState<ReadonlySet<string>>(new Set())
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set())
  const [reviewing, setReviewing] = useState(false)
  const [result, setResult] = useState<{ filed: number; foldersCreated: number } | null>(null)

  const plan = run.data?.status === "ready" ? run.data.plan : null
  const groups = useMemo(() => (plan ? groupMoves(plan, folders.data?.folders ?? []) : []), [plan, folders.data])
  const newGroups = groups.filter((group) => group.newFolderKey !== null)
  const liveGroups = groups.filter((group) => group.newFolderKey === null || !droppedFolders.has(group.newFolderKey))
  const kept = liveGroups.flatMap((group) => group.moves).filter((move) => !skipped.has(move.savedItemId))
  const keptNewFolders = new Set(kept.flatMap((move) => move.newFolderKey ?? []))

  const step: Step = result || apply.isPending
    ? "done"
    : run.data?.status === "running"
      ? "scan"
      : plan
        ? newGroups.length > 0 && !reviewing ? "folders" : "review"
        : "start"

  // The whole flow is one wizard, from the start to the save. The New folders
  // step drops out once a plan is known to suggest none.
  const steps: readonly { id: Step; label: string }[] = [
    { id: "start", label: "Start" },
    { id: "scan", label: "Scan" },
    ...(plan && newGroups.length === 0 ? [] : [{ id: "folders" as const, label: "New folders" }]),
    { id: "review", label: "Review" },
    { id: "done", label: "Save" },
  ]
  const current = ORDER.indexOf(step)

  const reset = () => {
    setDroppedFolders(new Set())
    setSkipped(new Set())
    setReviewing(false)
  }

  const close = () => {
    // A finished run is over; the next open starts fresh.
    if (result) setResult(null)
    onClose()
  }

  const begin = () => {
    reset()
    setResult(null)
    start.mutate()
  }

  const throwAway = () => discard.mutate(undefined, { onSuccess: reset })

  const toggle = (ids: readonly string[], keep: boolean) =>
    setSkipped((current) => {
      const next = new Set(current)
      for (const id of ids) keep ? next.delete(id) : next.add(id)
      return next
    })

  const toggleFolder = (key: string) =>
    setDroppedFolders((current) => {
      const next = new Set(current)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const confirm = () => {
    if (!plan) return
    apply.mutate(
      {
        newFolders: plan.newFolders.filter((folder) => keptNewFolders.has(folder.key)),
        moves: kept.map(({ savedItemId, folderId, newFolderKey }) => ({ savedItemId, folderId, newFolderKey })),
      },
      {
        onSuccess: (done) => {
          reset()
          setResult(done)
        },
      },
    )
  }

  let heading: string
  let body: ReactNode
  let footer: ReactNode

  switch (step) {
    case "start": {
      const unavailable = start.error ? folderErrorMessage(start.error) : null
      heading = "Find a place for every save"
      body = (
        <>
          <p className={styles.lead}>
            Sleevy reads each save that has no folder and matches it to your folders. You decide what moves.
          </p>
          <ol className={styles.explainer}>
            {[
              { icon: <ScanSearch size={17} />, title: "Scan", text: "Each save is matched to the folder it clearly fits." },
              { icon: <FolderPlus size={17} />, title: "New folders", text: "Groups that fit nowhere get a folder named like yours. Keep only the ones you like." },
              { icon: <ListChecks size={17} />, title: "Review", text: "See every move, and untick anything that should stay where it is." },
            ].map((item) => (
              <li key={item.title} className={styles.explainerItem}>
                <span className={styles.explainerIcon} aria-hidden>{item.icon}</span>
                <span>
                  <span className={styles.explainerTitle}>{item.title}</span>
                  <span className={styles.explainerText}>{item.text}</span>
                </span>
              </li>
            ))}
          </ol>
          {run.data?.status === "failed" ? <p className={styles.error}>The last scan could not finish. Nothing was moved.</p> : null}
          {unavailable ? <p className={styles.error}>{unavailable}</p> : null}
        </>
      )
      footer = (
        <>
          <span className={styles.footerNote}>Nothing moves until you confirm.</span>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={begin} disabled={start.isPending || !run.data}>
            {run.data?.status === "failed" ? "Try again" : "Start scan"}
          </Button>
        </>
      )
      break
    }
    case "scan": {
      const { phase, done, total } = run.data!
      const share = total > 0 ? Math.min(1, done / total) : 0
      const phases = [
        { id: "proposing", label: "Looking for new folders" },
        { id: "filing", label: "Sorting saves into folders" },
      ] as const
      const phaseIndex = phase === "filing" ? 1 : phase === "proposing" ? 0 : -1
      heading = "Scanning your unfiled saves"
      body = (
        <div className={styles.scan} role="status">
          <div className={styles.scanFigure}>
            <span className={styles.scanPercent}>{Math.round(share * 100)}<small>%</small></span>
            {total > 0 ? <span className={styles.count}>{done} of {total}</span> : null}
          </div>
          <div className={styles.track}>
            <m.div className={styles.fill} animate={{ width: `${Math.max(2, Math.round(share * 100))}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
          </div>
          <ul className={styles.phases}>
            {phases.map((item, index) => {
              const state = index < phaseIndex ? "on" : index === phaseIndex ? "busy" : "off"
              return (
                <li key={item.id} className={clsx(styles.phase, styles[`phase-${state}`])}>
                  {state === "busy" ? <span className={styles.spinner} aria-hidden /> : <Tick state={state === "on" ? "on" : "off"} />}
                  {item.label}
                </li>
              )
            })}
          </ul>
        </div>
      )
      footer = (
        <>
          <span className={styles.footerNote}>This runs on its own. You can close this and come back.</span>
          <Button variant="ghost" onClick={close}>Close</Button>
        </>
      )
      break
    }
    case "folders": {
      const keptCount = newGroups.filter((group) => !droppedFolders.has(group.newFolderKey!)).length
      heading = plural(newGroups.length, "new folder suggested", "new folders suggested")
      body = (
        <>
          <p className={styles.lead}>
            These groups of saves fit none of your folders. Keep a folder to make it; drop it and its saves stay unfiled.
          </p>
          <ul className={styles.folderList}>
            {newGroups.map((group) => {
              const key = group.newFolderKey!
              const keep = !droppedFolders.has(key)
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    className={clsx(styles.folderCard, !keep && styles.folderDropped)}
                    aria-pressed={keep}
                    onClick={() => toggleFolder(key)}
                    style={{ "--folder-swatch": swatch(group.color) } as CSSProperties}
                  >
                    <FolderTile emoji={group.emoji} color={group.color} size="lg" />
                    <span className={styles.folderText}>
                      <span className={styles.folderName}>{group.name}</span>
                      <span className={styles.folderSample}>{plural(group.moves.length, "save", "saves")}</span>
                      <span className={styles.favicons}>
                        {group.moves.slice(0, 4).map((move) => (
                          <span key={move.savedItemId} className={styles.sample}>
                            <img className={styles.faviconSmall} src={faviconUrl(hostOf(move.url))} alt="" loading="lazy" />
                            <span className={styles.sampleTitle}>{move.title ?? hostOf(move.url)}</span>
                          </span>
                        ))}
                      </span>
                    </span>
                    <Tick state={keep ? "on" : "off"} />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )
      footer = (
        <>
          <Button variant="ghost" onClick={throwAway} disabled={discard.isPending}>Discard plan</Button>
          <span className={styles.spacer} />
          <Button onClick={() => setReviewing(true)}>
            {keptCount === newGroups.length ? "Keep all and continue" : `Keep ${keptCount} and continue`}
          </Button>
        </>
      )
      break
    }
    case "review": {
      const nothing = liveGroups.length === 0
      const considered = plan!.considered
      heading = nothing ? "Everything stays put" : "Review the moves"
      body = nothing ? (
        <div className={styles.empty}>
          <span className={styles.emptyMark} aria-hidden><Folder size={22} /></span>
          <p className={styles.lead}>
            None of your {plural(considered, "unfiled save", "unfiled saves")} clearly fits a folder. They stay where they are.
          </p>
        </div>
      ) : (
        <>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>To move</dt>
              <dd>{kept.length}</dd>
            </div>
            <div className={styles.stat}>
              <dt>New folders</dt>
              <dd>{keptNewFolders.size}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Stay unfiled</dt>
              <dd>{considered - kept.length}</dd>
            </div>
          </dl>
          <div className={styles.groups}>
            {liveGroups.map((group) => {
              const ids = group.moves.map((move) => move.savedItemId)
              const keptCount = ids.filter((id) => !skipped.has(id)).length
              const all = keptCount === ids.length
              return (
                <section
                  key={group.id}
                  className={clsx(styles.group, keptCount === 0 && styles.groupOff)}
                  style={{ "--folder-swatch": swatch(group.color) } as CSSProperties}
                  aria-label={group.name}
                >
                  <label className={styles.groupHeader}>
                    <input
                      type="checkbox"
                      className={styles.srOnly}
                      checked={all}
                      ref={(input) => {
                        if (input) input.indeterminate = keptCount > 0 && !all
                      }}
                      onChange={(event) => toggle(ids, event.target.checked)}
                    />
                    <FolderTile emoji={group.emoji} color={group.color} />
                    <span className={styles.groupName}>{group.name}</span>
                    {group.newFolderKey ? <span className={styles.badge}>New folder</span> : null}
                    <span className={styles.groupCount}>{keptCount} of {ids.length}</span>
                    <Tick state={all ? "on" : keptCount > 0 ? "some" : "off"} />
                  </label>
                  <ul className={styles.items}>
                    {group.moves.map((move) => {
                      const on = !skipped.has(move.savedItemId)
                      const host = hostOf(move.url)
                      return (
                        <li key={move.savedItemId}>
                          <label className={clsx(styles.item, !on && styles.itemOff)}>
                            <input
                              type="checkbox"
                              className={styles.srOnly}
                              checked={on}
                              onChange={(event) => toggle([move.savedItemId], event.target.checked)}
                            />
                            <img className={styles.favicon} src={faviconUrl(host)} alt="" loading="lazy" />
                            <span className={styles.itemText}>
                              <span className={styles.itemTitle}>{move.title ?? move.url}</span>
                              <span className={styles.itemHost}>{host}</span>
                            </span>
                            <Tick state={on ? "on" : "off"} />
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
          {apply.error ? <p className={styles.error}>{folderErrorMessage(apply.error)}</p> : null}
        </>
      )
      footer = nothing ? (
        <>
          <span className={styles.spacer} />
          <Button onClick={throwAway} disabled={discard.isPending}>Done</Button>
        </>
      ) : (
        <>
          {newGroups.length > 0 ? (
            <Button variant="ghost" onClick={() => setReviewing(false)} disabled={apply.isPending}>Back</Button>
          ) : (
            <Button variant="ghost" onClick={throwAway} disabled={discard.isPending || apply.isPending}>Discard plan</Button>
          )}
          <span className={styles.spacer} />
          <Button onClick={confirm} disabled={kept.length === 0 || apply.isPending}>
            {apply.isPending
              ? "Moving…"
              : keptNewFolders.size > 0
                ? `Move ${plural(kept.length, "save", "saves")} · make ${plural(keptNewFolders.size, "folder", "folders")}`
                : `Move ${plural(kept.length, "save", "saves")}`}
          </Button>
        </>
      )
      break
    }
    case "done": {
      if (!result) {
        heading = "Saving your folders"
        body = (
          <div className={styles.done} role="status">
            <span className={styles.savingMark} aria-hidden><span className={styles.spinner} /></span>
            <p className={styles.doneTitle}>
              Moving {plural(kept.length, "save", "saves")}
              {keptNewFolders.size > 0 ? ` into ${plural(keptNewFolders.size, "new folder", "new folders")} and your own` : ""}…
            </p>
          </div>
        )
        footer = <span className={styles.spacer} />
        break
      }
      heading = "All sorted"
      body = (
        <div className={styles.done}>
          <m.span
            className={styles.doneMark}
            aria-hidden
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
          >
            <Check size={26} strokeWidth={2.5} />
          </m.span>
          <p className={styles.doneTitle}>
            Moved {plural(result!.filed, "save", "saves")}
            {result!.foldersCreated > 0 ? ` and made ${plural(result!.foldersCreated, "folder", "folders")}` : ""}.
          </p>
          <p className={styles.note}>When “Sort new saves into folders” is on, new saves go into these folders too.</p>
        </div>
      )
      footer = (
        <>
          <span className={styles.spacer} />
          <Button onClick={close}>Done</Button>
        </>
      )
      break
    }
  }

  const visible = steps.findIndex((item) => item.id === step)

  return (
    // Settings sits outside the app's LazyMotion, so the overlay brings its own.
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <Dialog.Root open={open} onOpenChange={(next) => { if (!next) close() }}>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay} />
            <Dialog.Content className={styles.content} aria-describedby={undefined}>
              <header className={styles.header}>
                <div className={styles.headerText}>
                  <span className={styles.eyebrow}>Organize · Step {visible + 1} of {steps.length}</span>
                  <Dialog.Title className={styles.title}>{heading}</Dialog.Title>
                </div>
                <Dialog.Close className={styles.close} aria-label="Close"><X size={16} /></Dialog.Close>
              </header>

              <ol className={styles.stepper} aria-label="Steps">
                {steps.map((item) => {
                  const position = ORDER.indexOf(item.id)
                  const state = current > position ? "stepDone" : current === position ? "stepCurrent" : "stepTodo"
                  return (
                    <li key={item.id} className={clsx(styles.stepItem, styles[state])} aria-current={state === "stepCurrent" ? "step" : undefined}>
                      <span className={styles.stepBar}>
                        <m.span
                          className={styles.stepBarFill}
                          initial={false}
                          animate={{ scaleX: state === "stepTodo" ? 0 : 1 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                        />
                      </span>
                      <span className={styles.stepLabel}>
                        {state === "stepDone" ? <Check size={12} strokeWidth={3} /> : null}
                        {item.label}
                      </span>
                    </li>
                  )
                })}
              </ol>

              <div className={styles.body}>
                <AnimatePresence mode="wait" initial={false}>
                  <m.div
                    key={step}
                    className={styles.stepBody}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {body}
                  </m.div>
                </AnimatePresence>
              </div>

              <footer className={styles.footer}>{footer}</footer>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </MotionConfig>
    </LazyMotion>
  )
}
