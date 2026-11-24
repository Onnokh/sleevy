import { Plus } from "lucide-react"
import type { ReactNode } from "react"

import { useKeyboardNav } from "../../../contexts/keyboard-nav-context"
import styles from "./page-actions.module.scss"

/**
 * A page's actions as one glass capsule at the end of its title, as the iOS
 * toolbar holds them: the sort and filter menu, then Capture, last on every
 * page.
 */
export function PageActions({ children }: { readonly children?: ReactNode }) {
  const { openCaptureDialog } = useKeyboardNav()

  return (
    <div className={styles.capsule}>
      {children}
      <button type="button" className={styles.button} aria-label="Capture item" title="Capture item" onClick={() => openCaptureDialog()}>
        <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}

/** The class of a button inside the capsule, for a menu trigger to share. */
export const pageActionButtonClassName = styles.button
