import * as Dialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import { Check, Folder, X } from "lucide-react"
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
  color && color in colorSwatches ? colorSwatches[color as FolderCardColor] : "var(--muted)"

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

  const step: Step = result
    ? "done"
    : run.data?.status === "running"
      ? "scan"
      : plan
        ? newGroups.length > 0 && !reviewing ? "folders" : "review"
        : "start"

  const steps: readonly { id: Step; label: string }[] = [
    { id: "scan", label: "Scan" },
    ...(plan && newGroups.length === 0 ? [] : [{ id: "folders" as const, label: "New folders" }]),
    { id: "review", label: "Review" },
  ]
  const order: Step[] = ["start", "scan", "folders", "review", "done"]

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

  let body: ReactNode
  let footer: ReactNode

  switch (step) {
    case "start": {
      const unavailable = start.error ? folderErrorMessage(start.error) : null
      body = (
        <>
          <p className={styles.lead}>
            Sleevy reads every save that has no folder and finds where it belongs.
          </p>
          <ol className={styles.explainer}>
            <li><strong>Scan.</strong> Each save is matched against your folders. Where a group of saves fits none, a new folder is suggested, named like yours.</li>
            <li><strong>New folders.</strong> Keep the suggestions you like and drop the rest.</li>
            <li><strong>Review.</strong> See every move and untick anything that should stay where it is.</li>
          </ol>
          <p className={styles.note}>Nothing moves until you confirm. The scan runs on its own, so you can close this and come back.</p>
          {run.data?.status === "failed" ? <p className={styles.error}>The last scan could not finish. Nothing was moved.</p> : null}
          {unavailable ? <p className={styles.error}>{unavailable}</p> : null}
        </>
      )
      footer = (
        <>
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
      body = (
        <div className={styles.scan} role="status">
          <div className={styles.scanLabel}>
            <span>{phase === "proposing" ? "Looking for new folders" : phase === "filing" ? "Sorting saves" : "Getting started"}</span>
            {total > 0 ? <span className={styles.count}>{done} of {total}</span> : null}
          </div>
          <div className={styles.track}>
            <m.div className={styles.fill} animate={{ width: `${Math.round(share * 100)}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
          </div>
          <p className={styles.note}>
            {phase === "proposing"
              ? "Checking which groups of saves need a folder you do not have yet."
              : "Placing each save in the folder it clearly fits. A save that fits none stays unfiled."}
          </p>
        </div>
      )
      footer = <Button variant="ghost" onClick={close}>Close and keep scanning</Button>
      break
    }
    case "folders": {
      body = (
        <>
          <p className={styles.lead}>
            {plural(newGroups.length, "new folder fits", "new folders fit")} your unfiled saves. Drop any you do not want; their saves stay unfiled.
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
                    <span className={styles.folderIcon} aria-hidden>{group.emoji ?? <Folder size={16} />}</span>
                    <span className={styles.folderText}>
                      <span className={styles.folderName}>{group.name}</span>
                      <span className={styles.folderSample}>
                        {plural(group.moves.length, "save", "saves")} · {group.moves.slice(0, 2).map((move) => move.title ?? move.url).join(", ")}
                      </span>
                    </span>
                    <span className={clsx(styles.check, keep && styles.checkOn)} aria-hidden>
                      {keep ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )
      footer = (
        <>
          <Button variant="ghost" onClick={throwAway} disabled={discard.isPending}>Discard</Button>
          <Button onClick={() => setReviewing(true)}>Continue</Button>
        </>
      )
      break
    }
    case "review": {
      const nothing = liveGroups.length === 0
      body = nothing ? (
        <p className={styles.lead}>
          None of your {plural(plan!.considered, "unfiled save", "unfiled saves")} clearly fits a folder. They stay where they are.
        </p>
      ) : (
        <>
          <p className={styles.lead}>
            {plural(kept.length, "save moves", "saves move")}, out of {plural(plan!.considered, "unfiled save", "unfiled saves")}. Untick anything that should stay where it is.
          </p>
          <div className={styles.groups}>
            {liveGroups.map((group) => {
              const ids = group.moves.map((move) => move.savedItemId)
              const keptCount = ids.filter((id) => !skipped.has(id)).length
              return (
                <fieldset key={group.id} className={styles.group}>
                  <legend className={styles.groupHeader}>
                    <label className={styles.groupToggle}>
                      <input
                        type="checkbox"
                        checked={keptCount === ids.length}
                        ref={(input) => {
                          if (input) input.indeterminate = keptCount > 0 && keptCount < ids.length
                        }}
                        onChange={(event) => toggle(ids, event.target.checked)}
                      />
                      <span className={styles.groupName}>
                        {group.emoji ? <span aria-hidden>{group.emoji} </span> : null}
                        {group.name}
                      </span>
                    </label>
                    {group.newFolderKey ? <span className={styles.badge}>New</span> : null}
                    <span className={styles.count}>{keptCount}</span>
                  </legend>
                  <ul className={styles.items}>
                    {group.moves.map((move) => (
                      <li key={move.savedItemId}>
                        <label className={styles.item}>
                          <input
                            type="checkbox"
                            checked={!skipped.has(move.savedItemId)}
                            onChange={(event) => toggle([move.savedItemId], event.target.checked)}
                          />
                          <span className={styles.itemTitle}>{move.title ?? move.url}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )
            })}
          </div>
          {apply.error ? <p className={styles.error}>{folderErrorMessage(apply.error)}</p> : null}
        </>
      )
      footer = nothing ? (
        <Button onClick={throwAway} disabled={discard.isPending}>Done</Button>
      ) : (
        <>
          {newGroups.length > 0 ? (
            <Button variant="ghost" onClick={() => setReviewing(false)} disabled={apply.isPending}>Back</Button>
          ) : (
            <Button variant="ghost" onClick={throwAway} disabled={discard.isPending || apply.isPending}>Discard</Button>
          )}
          <Button onClick={confirm} disabled={kept.length === 0 || apply.isPending}>
            {apply.isPending ? "Moving…" : `Move ${plural(kept.length, "save", "saves")}`}
          </Button>
        </>
      )
      break
    }
    case "done": {
      body = (
        <div className={styles.done}>
          <span className={styles.doneMark} aria-hidden><Check size={22} strokeWidth={2.5} /></span>
          <p className={styles.doneTitle}>
            Moved {plural(result!.filed, "save", "saves")}
            {result!.foldersCreated > 0 ? ` and made ${plural(result!.foldersCreated, "folder", "folders")}` : ""}.
          </p>
          <p className={styles.note}>New saves go into these folders too when “Sort new saves into folders” is on.</p>
        </div>
      )
      footer = <Button onClick={close}>Done</Button>
      break
    }
  }

  const current = order.indexOf(step)

  return (
    // Settings sits outside the app's LazyMotion, so the overlay brings its own.
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <Dialog.Root open={open} onOpenChange={(next) => { if (!next) close() }}>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay} />
            <Dialog.Content className={styles.content} aria-describedby={undefined}>
              <header className={styles.header}>
                <Dialog.Title className={styles.title}>Organize unfiled saves</Dialog.Title>
                <Dialog.Close className={styles.close} aria-label="Close"><X size={16} /></Dialog.Close>
              </header>
    
              <ol className={styles.stepper} aria-label="Steps">
                {steps.map((item, index) => {
                  const position = order.indexOf(item.id)
                  const state = current > position ? "stepDone" : current === position ? "stepCurrent" : "stepTodo"
                  return (
                    <li key={item.id} className={clsx(styles.stepItem, styles[state])} aria-current={state === "stepCurrent" ? "step" : undefined}>
                      <span className={styles.stepDot}>{state === "stepDone" ? <Check size={11} strokeWidth={3} /> : index + 1}</span>
                      <span className={styles.stepLabel}>{item.label}</span>
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
