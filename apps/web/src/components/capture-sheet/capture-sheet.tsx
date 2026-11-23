import * as Dialog from "@radix-ui/react-dialog"
import { Check, ClipboardPaste, Link2, LoaderCircle, X } from "lucide-react"
import { useRef } from "react"

import { useCapture } from "../../sleevy/saved-items"
import styles from "./capture-sheet.module.scss"

/**
 * The Capture Sheet, as the iOS app has it: a small sheet that rises from the
 * bottom of the window with one URL field, Cancel at the leading edge of its
 * bar and Save at the trailing edge. Paste saves a copied link at once. It
 * cannot be closed while a save is on its way, and a failed save keeps the
 * URL with a short error under it.
 */
export function CaptureSheet({ initialUrl, onClose }: { readonly initialUrl: string; readonly onClose: () => void }) {
  const capture = useCapture(initialUrl)
  const fieldRef = useRef<HTMLInputElement>(null)
  const trimmed = capture.url.trim()
  // The Capture Endpoint decides what a valid URL is; the sheet only keeps
  // Save off for what is plainly empty.
  const canSave = trimmed.length > 0 && !capture.isPending

  const save = (url = trimmed) => {
    if (!url || capture.isPending) return
    capture.captureUrl(url, onClose)
  }

  // The browser asks before it gives the clipboard, so the sheet reads it
  // only when Paste is pressed, never on open.
  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (!text) return
      capture.setUrl(text)
      save(text)
    } catch {
      fieldRef.current?.focus()
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !capture.isPending) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content
          className={styles.sheet}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            fieldRef.current?.focus()
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <div className={styles.bar}>
              <Dialog.Close className={styles.round} aria-label="Cancel" disabled={capture.isPending}>
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </Dialog.Close>
              <Dialog.Title className={styles.title}>Add Link</Dialog.Title>
              <button type="submit" className={`${styles.round} ${styles.save}`} aria-label="Save" disabled={!canSave}>
                {capture.isPending
                  ? <LoaderCircle className={styles.spinner} size={18} strokeWidth={2} aria-hidden="true" />
                  : <Check size={18} strokeWidth={2.25} aria-hidden="true" />}
              </button>
            </div>

            <div className={styles.field}>
              <Link2 className={styles.fieldIcon} size={18} strokeWidth={2} aria-hidden="true" />
              <input
                ref={fieldRef}
                className={styles.input}
                type="url"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Paste or type URL"
                aria-label="URL"
                value={capture.url}
                readOnly={capture.isPending}
                onChange={(event) => capture.setUrl(event.target.value)}
              />
              {trimmed || capture.isPending ? null : (
                <button type="button" className={styles.paste} onClick={() => void paste()}>
                  <ClipboardPaste size={14} strokeWidth={2} aria-hidden="true" />
                  Paste
                </button>
              )}
            </div>

            {capture.formError ? <p className={styles.error} role="alert">{capture.formError}</p> : null}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
