import { useState } from "react"

import { useOrganizeRun } from "../../sleevy/organize"
import { Button } from "../ui/button/button"
import styles from "./organize-library.module.scss"
import { OrganizeWizard } from "./organize-wizard"

/**
 * Organize, the one-off companion to Auto-Filing: it sorts the saves that are
 * already unfiled, and unlike Auto-Filing it may suggest new Folders, named the
 * way the person names theirs. Settings only holds the way in; the work happens
 * in {@link OrganizeWizard}. The button names where the run is, so a scan left
 * running or a plan left unreviewed is easy to find again.
 */
export function OrganizeLibrary() {
  const run = useOrganizeRun()
  const [open, setOpen] = useState(false)

  const status = run.data?.status
  const action = status === "running" ? "View progress" : status === "ready" ? "Review plan" : "Organize"

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <div className={styles.text}>
          <span className={styles.label}>Organize unfiled saves</span>
          <p className={styles.description}>
            {status === "running"
              ? "A scan is running. You can watch it or leave it."
              : status === "ready"
                ? "A plan is ready. Nothing moves until you confirm it."
                : "Sorts every save without a folder, and suggests new folders named like yours."}
          </p>
        </div>
        <Button variant="ghost" onClick={() => setOpen(true)} disabled={!run.data}>
          {action}
        </Button>
      </div>
      <OrganizeWizard open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
