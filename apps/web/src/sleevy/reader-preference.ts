import { useSyncExternalStore } from "react"

const STORAGE_KEY = "sleeve:readerViewDisabled"

/**
 * Whether this reader has turned the Reader View off. Off by default, so the
 * Reader View is what a Saved Item opens into unless someone says otherwise.
 *
 * It is a setting for this browser rather than for the account: it says how
 * this person likes to read here, and the Web Companion is one of several
 * clients. That also keeps it instant — nothing to fetch before the first card
 * can decide where it leads.
 */
const listeners = new Set<() => void>()

const read = (): boolean => {
  // The app renders on the server too, where there is no storage and the
  // default is the answer.
  if (typeof localStorage === "undefined") return false
  return localStorage.getItem(STORAGE_KEY) === "true"
}

export const isReaderViewDisabled = read

export function setReaderViewDisabled(disabled: boolean): void {
  if (disabled) {
    localStorage.setItem(STORAGE_KEY, "true")
  } else {
    // Absent rather than "false", so the stored value only ever means the
    // setting was changed from its default.
    localStorage.removeItem(STORAGE_KEY)
  }
  for (const listener of listeners) listener()
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange)
  // A `storage` event fires in the other tabs, not the one that wrote, so the
  // set above notifies this tab and this notifies the rest.
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function useReaderViewDisabled(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}
