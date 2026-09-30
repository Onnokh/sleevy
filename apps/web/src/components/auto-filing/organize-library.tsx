import { useMemo, useState } from "react"

import { folderErrorMessage, useFolders } from "../../sleevy/folders"
import {
  type OrganizePlan,
  useApplyOrganize,
  useDiscardOrganize,
  useOrganizeRun,
  useStartOrganize,
} from "../../sleevy/organize"
import { Button } from "../ui/button/button"
import styles from "./organize-library.module.scss"

type Group = {
  readonly id: string
  readonly name: string
  readonly emoji: string | null
  readonly isNew: boolean
  readonly moves: OrganizePlan["moves"]
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** The plan's moves, one group per target Folder: existing Folders first, then the new ones. */
function groupMoves(plan: OrganizePlan, folders: readonly { id: string; name: string; emoji: string | null }[]): Group[] {
  const existing = new Map(folders.map((folder) => [folder.id, folder]))
  const groups = new Map<string, Group>()
  for (const move of plan.moves) {
    const id = move.folderId ?? `new:${move.newFolderKey}`
    let group = groups.get(id)
    if (!group) {
      const folder = move.folderId ? existing.get(move.folderId) : undefined
      const proposed = move.newFolderKey ? plan.newFolders.find((candidate) => candidate.key === move.newFolderKey) : undefined
      // A Folder deleted since the plan was made has nowhere to go.
      if (!folder && !proposed) continue
      group = {
        id,
        name: folder?.name ?? proposed!.name,
        emoji: folder?.emoji ?? proposed?.emoji ?? null,
        isNew: !folder,
        moves: [],
      }
      groups.set(id, group)
    }
    ;(group.moves as OrganizePlan["moves"][number][]).push(move)
  }
  return [...groups.values()].sort((left, right) => Number(left.isNew) - Number(right.isNew))
}

/**
 * Organize, the one-off companion to Auto-Filing: it sorts the saves that are
 * already unfiled, and unlike Auto-Filing it may suggest new Folders, named the
 * way the person names theirs. It runs in the background, so the page may be
 * left and come back to; nothing moves until the person applies the plan.
 */
export function OrganizeLibrary() {
  const run = useOrganizeRun()
  const start = useStartOrganize()
  const discard = useDiscardOrganize()
  const apply = useApplyOrganize()
  const folders = useFolders()
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set())
  const [result, setResult] = useState<string | null>(null)

  const plan = run.data?.status === "ready" ? run.data.plan : null
  const groups = useMemo(
    () => (plan ? groupMoves(plan, folders.data?.folders ?? []) : []),
    [plan, folders.data],
  )
  const kept = groups.flatMap((group) => group.moves).filter((move) => !skipped.has(move.savedItemId))
  const keptNewFolders = new Set(kept.flatMap((move) => move.newFolderKey ?? []))

  const toggle = (ids: readonly string[], keep: boolean) =>
    setSkipped((current) => {
      const next = new Set(current)
      for (const id of ids) keep ? next.delete(id) : next.add(id)
      return next
    })

  const begin = () => {
    setResult(null)
    setSkipped(new Set())
    start.mutate()
  }

  const confirm = () => {
    if (!plan) return
    apply.mutate(
      {
        newFolders: plan.newFolders.filter((folder) => keptNewFolders.has(folder.key)),
        moves: kept.map(({ savedItemId, folderId, newFolderKey }) => ({ savedItemId, folderId, newFolderKey })),
      },
      {
        onSuccess: (done) => {
          setSkipped(new Set())
          setResult(
            done.foldersCreated > 0
              ? `Moved ${plural(done.filed, "save", "saves")} and made ${plural(done.foldersCreated, "folder", "folders")}.`
              : `Moved ${plural(done.filed, "save", "saves")}.`,
          )
        },
      },
    )
  }

  const intro = (
    <div className={styles.text}>
      <span className={styles.label}>Organize unfiled saves</span>
      <p className={styles.description}>
        Sorts every save without a folder into the folder it clearly fits. Where a group of saves fits none, it
        suggests a new folder named like yours. You see the plan before anything moves.
      </p>
    </div>
  )

  if (!run.data) return null

  if (run.data.status === "running") {
    const { phase, done, total } = run.data
    const share = total > 0 ? Math.min(1, done / total) : 0
    return (
      <div className={styles.panel}>
        {intro}
        <div className={styles.progress} role="status">
          <div className={styles.progressLabel}>
            <span>{phase === "proposing" ? "Looking for new folders" : phase === "filing" ? "Sorting saves" : "Getting started"}</span>
            {total > 0 ? <span className={styles.count}>{done} of {total}</span> : null}
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${Math.round(share * 100)}%` }} />
          </div>
          <p className={styles.hint}>This runs on its own. You can leave this page and come back.</p>
        </div>
      </div>
    )
  }

  if (run.data.status === "ready" && plan) {
    const nothing = groups.length === 0
    return (
      <div className={styles.panel}>
        {intro}
        {nothing ? (
          <p className={styles.summary}>
            None of your {plural(plan.considered, "unfiled save", "unfiled saves")} clearly fits a folder. They stay
            where they are.
          </p>
        ) : (
          <>
            <p className={styles.summary}>
              {plural(plan.moves.length, "save has", "saves have")} a place, out of{" "}
              {plural(plan.considered, "unfiled save", "unfiled saves")}.
              {plan.newFolders.length > 0 ? ` ${plural(plan.newFolders.length, "new folder", "new folders")} suggested.` : ""}{" "}
              Untick anything that should stay where it is.
            </p>
            <div className={styles.groups}>
              {groups.map((group) => {
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
                      {group.isNew ? <span className={styles.badge}>New</span> : null}
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
          </>
        )}
        {apply.error ? <p className={styles.error}>{folderErrorMessage(apply.error)}</p> : null}
        <div className={styles.actions}>
          {nothing ? (
            <Button onClick={() => discard.mutate()} disabled={discard.isPending}>Done</Button>
          ) : (
            <>
              <Button onClick={confirm} disabled={kept.length === 0 || apply.isPending}>
                {apply.isPending ? "Moving…" : `Move ${plural(kept.length, "save", "saves")}`}
              </Button>
              <Button variant="ghost" onClick={() => discard.mutate()} disabled={discard.isPending || apply.isPending}>
                Discard
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  const unavailable = start.error ? folderErrorMessage(start.error) : null
  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        {intro}
        <Button variant="ghost" onClick={begin} disabled={start.isPending}>
          {run.data.status === "failed" ? "Try again" : "Organize"}
        </Button>
      </div>
      {run.data.status === "failed" ? <p className={styles.error}>The last run could not finish. Nothing was moved.</p> : null}
      {unavailable ? <p className={styles.error}>{unavailable}</p> : null}
      {result ? <p className={styles.summary} role="status">{result}</p> : null}
    </div>
  )
}
