import { type FormEvent, useEffect, useRef } from "react"
import { Link2 } from "lucide-react"
import { m } from "motion/react"

import { type SavedItem, useCapture } from "../../sleevy/saved-items"
import styles from "./first-run-inbox.module.scss"

// How wide the title bar of each placeholder row is, so the rows read as a
// list to come rather than as one repeated shape.
const GHOST_TITLE_WIDTHS = ["46%", "58%", "38%", "50%"] as const

/**
 * The Inbox of an Account that has saved nothing yet. All Caught Up would tell
 * that person they are done before they have begun, so this state asks for the
 * first link instead, with Manual URL Capture as the first row of the list.
 */
export function FirstRunInbox({ onCaptured }: { readonly onCaptured: (savedItem: SavedItem) => void }) {
  const capture = useCapture()
  const inputRef = useRef<HTMLInputElement>(null)
  const hasUrl = capture.url.trim().length > 0

  // The one thing to do on this screen, so the field is ready for a paste
  // without a click first.
  useEffect(() => inputRef.current?.focus(), [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    capture.captureUrl(capture.url, (response) => onCaptured(response.savedItem))
  }

  return (
    <section className={styles.firstRun} aria-label="Save your first link">
      {/* Shared with the Enrichment Reveal, so this field grows into the card
          of the link it saved instead of being swapped for it. */}
      <m.form
        layoutId="first-save"
        transition={{ layout: { type: "spring", duration: 0.5, bounce: 0 } }}
        className={styles.capture}
        style={{ borderRadius: 14 }}
        onSubmit={submit}
      >
        <Link2 className={styles.captureIcon} size={20} strokeWidth={1.9} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.captureInput}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label="Link to save"
          placeholder="Paste a link you mean to read"
          value={capture.url}
          disabled={capture.isPending}
          onChange={(event) => capture.setUrl(event.target.value)}
        />
        {hasUrl ? (
          <button type="submit" className={styles.captureSubmit} disabled={capture.isPending}>
            {capture.isPending ? "Saving..." : <>Save <kbd>↵</kbd></>}
          </button>
        ) : (
          <kbd className={styles.key}>⌘V</kbd>
        )}
      </m.form>

      {capture.formError ? <p className={styles.error} role="alert">{capture.formError}</p> : null}

      <div className={styles.hints}>
        <p className={styles.promise}>
          Sleevy fetches the page, writes one line on what it says, and tags it. You don't file anything.
        </p>
        <span className={styles.keys}>
          <span><kbd className={styles.key}>n</kbd> capture</span>
          <span><kbd className={styles.key}>⌘K</kbd> search and commands</span>
        </span>
      </div>

      <ul className={styles.ghostRows} aria-hidden="true">
        {GHOST_TITLE_WIDTHS.map((width) => (
          <li key={width} className={styles.ghostRow}>
            <span className={styles.ghostFavicon} />
            <span className={styles.ghostBody}>
              <span className={styles.ghostTitle} style={{ width }} />
              <span className={styles.ghostHost} />
            </span>
            <span className={styles.ghostDate} />
          </li>
        ))}
      </ul>
    </section>
  )
}
