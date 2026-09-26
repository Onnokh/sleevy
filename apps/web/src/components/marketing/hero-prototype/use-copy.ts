// PROTOTYPE — throwaway.
import { useState } from "react"

/** Copies text and reports "copied" for a moment. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(text)
      setTimeout(() => setCopied((current) => (current === text ? null : current)), 1600)
    })
  }
  return { copied, copy }
}
