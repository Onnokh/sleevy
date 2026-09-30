import * as Dialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import { Check, X } from "lucide-react"
import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig } from "motion/react"
import { Fragment, type ReactNode, useMemo, useState } from "react"

import { folderErrorMessage, useFolders } from "../../sleevy/folders"
import {
  type OrganizePlan,
  useApplyOrganize,
  useDiscardOrganize,
  useOrganizeRun,
  useStartOrganize,
} from "../../sleevy/organize"
import { FolderCardBackground } from "../folders/folder-card-background"
import { faviconUrl } from "../saved-card/saved-card"
import { Button } from "../ui/button/button"
import styles from "./organize-wizard.module.scss"

type Move = OrganizePlan["moves"][number]

type Group = {
  /** The Folder's id, or the proposed Folder's key; either seeds its card. */
  readonly id: string
  readonly name: string
  readonly color: string | null
  /** The proposed Folder's key, or null for a Folder the person already has. */
  readonly newFolderKey: string | null
  readonly moves: readonly Move[]
}

type Step = "start" | "scan" | "folders" | "review" | "done"

const ORDER: readonly Step[] = ["start", "scan", "folders", "review", "done"]

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** The plan's moves, one group per target Folder: existing Folders first, then the new ones. */
function groupMoves(plan: OrganizePlan, folders: readonly { id: string; name: string; color: string | null }[]): Group[] {
  const existing = new Map(folders.map((folder) => [folder.id, folder]))
  const groups = new Map<string, { group: Group; moves: Move[] }>()
  for (const move of plan.moves) {
    const target = move.folderId ?? `new:${move.newFolderKey}`
    let entry = groups.get(target)
    if (!entry) {
      const folder = move.folderId ? existing.get(move.folderId) : undefined
      const proposed = move.newFolderKey ? plan.newFolders.find((candidate) => candidate.key === move.newFolderKey) : undefined
      // A Folder deleted since the plan was made has nowhere to go.
      if (!folder && !proposed) continue
      const moves: Move[] = []
      entry = {
        moves,
        group: folder
          ? { id: folder.id, name: folder.name, color: folder.color, newFolderKey: null, moves }
          : { id: proposed!.key, name: proposed!.name, color: proposed!.color, newFolderKey: proposed!.key, moves },
      }
      groups.set(target, entry)
    }
    entry.moves.push(move)
  }
  return [...groups.values()]
    .map(({ group }) => group)
    .sort((left, right) => Number(left.newFolderKey !== null) - Number(right.newFolderKey !== null))
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Organize as one guided overlay: start, watch the scan, keep or drop the new
 * Folders, untick any move, then save. It is built from the Library's own
 * parts, the Folder cards and the saved-item rows, so the plan reads as the
 * Library it will become. The run lives on the server, so closing the overlay
 * loses nothing; opening it again picks up at the same step.
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

  const step: Step = result
    ? "done"
    : run.data?.status === "running"
      ? "scan"
      : plan
        ? newGroups.length > 0 && !reviewing ? "folders" : "review"
        : "start"

  // The New folders step drops out once a plan is known to suggest none.
  const steps: readonly { id: Step; label: string }[] = [
    { id: "start", label: "Start" },
    { id: "scan", label: "Scan" },
    ...(plan && newGroups.length === 0 ? [] : [{ id: "folders" as const, label: "Folders" }]),
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

  let summary: string
  let body: ReactNode
  let footer: ReactNode

  switch (step) {
    case "start": {
      const unavailable = start.error ? folderErrorMessage(start.error) : null
      summary = "Sort your unfiled saves"
      body = (
        <>
          <p className={styles.text}>
            Sleevy reads every save without a folder and puts it in the folder it clearly fits. Where a group of saves fits
            none of yours, it suggests a new folder, named the way you name yours.
          </p>
          <p className={styles.text}>You see the whole plan and can change it. Nothing moves until you save.</p>
          {run.data?.status === "failed" ? <p className={styles.error}>The last scan could not finish. Nothing was moved.</p> : null}
          {unavailable ? <p className={styles.error}>{unavailable}</p> : null}
        </>
      )
      footer = (
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={begin} disabled={start.isPending || !run.data}>
            {run.data?.status === "failed" ? "Try again" : "Start"}
          </Button>
        </>
      )
      break
    }
    case "scan": {
      const { phase, done, total } = run.data!
      const share = total > 0 ? Math.min(1, done / total) : 0
      summary = total > 0 ? plural(total, "unfiled save", "unfiled saves") : "Getting started"
      body = (
        <div className={styles.scan} role="status">
          <div className={styles.scanLine}>
            <span>{phase === "proposing" ? "Looking for new folders" : phase === "filing" ? "Sorting saves" : "Getting started"}</span>
            {total > 0 ? <span className={styles.scanCount}>{done} of {total}</span> : null}
          </div>
          <div className={styles.track}>
            <m.div className={styles.fill} animate={{ scaleX: share }} initial={false} transition={{ duration: 0.5, ease: "easeOut" }} />
          </div>
          <p className={styles.hint}>This keeps going if you close it.</p>
        </div>
      )
      footer = <Button variant="ghost" onClick={close}>Close</Button>
      break
    }
    case "folders": {
      const keptCount = newGroups.filter((group) => !droppedFolders.has(group.newFolderKey!)).length
      summary = plural(newGroups.length, "new folder", "new folders")
      body = (
        <>
          <p className={styles.text}>
            These saves fit none of your folders. Click a folder to leave it out; its saves stay unfiled.
          </p>
          <ul className={styles.cards}>
            {newGroups.map((group) => {
              const key = group.newFolderKey!
              const keep = !droppedFolders.has(key)
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    className={clsx(styles.card, !keep && styles.cardOff)}
                    aria-pressed={keep}
                    onClick={() => toggleFolder(key)}
                  >
                    <FolderCardBackground folderId={group.id} color={group.color} />
                    <span className={styles.cardName}>{group.name}</span>
                    <span className={styles.cardMeta}>{keep ? group.moves.length : "Left out"}</span>
                  </button>
                  <ul className={styles.peek}>
                    {group.moves.slice(0, 3).map((move) => (
                      <li key={move.savedItemId}>{move.title ?? hostOf(move.url)}</li>
                    ))}
                    {group.moves.length > 3 ? <li>and {group.moves.length - 3} more</li> : null}
                  </ul>
                </li>
              )
            })}
          </ul>
        </>
      )
      footer = (
        <>
          <Button variant="ghost" onClick={throwAway} disabled={discard.isPending}>Discard</Button>
          <span className={styles.spacer} />
          <Button onClick={() => setReviewing(true)} disabled={discard.isPending}>
            {keptCount === 0 ? "Continue without new folders" : "Continue"}
          </Button>
        </>
      )
      break
    }
    case "review": {
      const nothing = liveGroups.length === 0
      const considered = plan!.considered
      summary = nothing
        ? plural(considered, "unfiled save", "unfiled saves")
        : `${kept.length} of ${plural(considered, "unfiled save", "unfiled saves")} move`
      body = nothing ? (
        <p className={styles.text}>None of these saves clearly fits a folder. They stay where they are.</p>
      ) : (
        <>
          {liveGroups.map((group) => {
            const ids = group.moves.map((move) => move.savedItemId)
            const keptCount = ids.filter((id) => !skipped.has(id)).length
            return (
              <section key={group.id} className={styles.group} aria-label={group.name}>
                <div className={clsx(styles.card, styles.cardSmall, keptCount === 0 && styles.cardOff)}>
                  <FolderCardBackground folderId={group.id} color={group.color} />
                  <span className={styles.cardName}>{group.name}</span>
                  <span className={styles.cardMeta}>
                    {group.newFolderKey ? <span className={styles.cardNew}>New</span> : null}
                    {keptCount}
                  </span>
                </div>
                <ul className={styles.rows}>
                  {group.moves.map((move) => {
                    const on = !skipped.has(move.savedItemId)
                    const host = hostOf(move.url)
                    return (
                      <li key={move.savedItemId}>
                        <label className={clsx(styles.row, !on && styles.rowOff)}>
                          <img className={styles.favicon} src={faviconUrl(host)} alt="" loading="lazy" />
                          <span className={styles.rowBody}>
                            <span className={styles.rowTitle}>{move.title ?? move.url}</span>
                            <span className={styles.rowHost}>{host}</span>
                          </span>
                          <input
                            type="checkbox"
                            className={styles.check}
                            checked={on}
                            onChange={(event) => toggle([move.savedItemId], event.target.checked)}
                            aria-label={`Move ${move.title ?? host} to ${group.name}`}
                          />
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
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
            <Button variant="ghost" onClick={throwAway} disabled={discard.isPending || apply.isPending}>Discard</Button>
          )}
          <span className={styles.spacer} />
          <Button onClick={confirm} disabled={kept.length === 0 || apply.isPending}>
            {apply.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      )
      break
    }
    case "done": {
      summary = "Saved"
      body = (
        <p className={styles.text}>
          Moved {plural(result!.filed, "save", "saves")}
          {result!.foldersCreated > 0 ? ` and made ${plural(result!.foldersCreated, "new folder", "new folders")}` : ""}.
          {" "}When “Sort new saves into folders” is on, new saves go into these folders too.
        </p>
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

  return (
    // Settings sits outside the app's LazyMotion, so the overlay brings its own.
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <Dialog.Root open={open} onOpenChange={(next) => { if (!next) close() }}>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay} />
            <Dialog.Content className={styles.content} aria-describedby={undefined}>
              <header className={styles.header}>
                <div>
                  <Dialog.Title className={styles.title}>Organize</Dialog.Title>
                  <p className={styles.summary}>{summary}</p>
                </div>
                <Dialog.Close className={styles.close} aria-label="Close"><X size={16} /></Dialog.Close>
              </header>

              <ol className={styles.steps} aria-label="Steps">
                {steps.map((item, index) => {
                  const position = ORDER.indexOf(item.id)
                  return (
                    <Fragment key={item.id}>
                      {index > 0 ? <li className={styles.stepRule} aria-hidden /> : null}
                      <li
                        className={clsx(
                          styles.step,
                          current > position && styles.stepPast,
                          current === position && styles.stepNow,
                        )}
                        aria-current={current === position ? "step" : undefined}
                      >
                        {current > position ? <Check size={12} strokeWidth={2.5} aria-hidden /> : null}
                        {item.label}
                      </li>
                    </Fragment>
                  )
                })}
              </ol>

              <div className={styles.body}>
                <AnimatePresence mode="wait" initial={false}>
                  <m.div
                    key={step}
                    className={styles.stepBody}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
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
