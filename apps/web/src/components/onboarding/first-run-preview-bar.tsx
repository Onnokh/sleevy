import { exitFirstRunPreview, type FirstRunPreview } from "../../sleevy/first-run-preview"
import styles from "./first-run-preview-bar.module.scss"

/// Says, while a first-run preview runs, that the Inbox is not showing the
/// Account's real Saved Items, and ends it. Development builds only.
export function FirstRunPreviewBar({ preview }: { readonly preview: FirstRunPreview }) {
  return (
    <div className={styles.bar} role="status">
      <span className={styles.label}>First-run preview</span>
      <span className={styles.note}>
        Saves are real. Only this Inbox is in preview{preview.sampleAi ? ", with a sample summary" : ""}.
      </span>
      <button type="button" className={styles.exit} onClick={exitFirstRunPreview}>Exit preview</button>
    </div>
  )
}
