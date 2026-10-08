import { detectPlatform, formatForDisplay } from "@tanstack/react-hotkeys"
import { useSyncExternalStore } from "react"

export type Platform = ReturnType<typeof detectPlatform>

/// A hotkey as the keyboard in front of the person names it: `Mod+K` is `⌘K`
/// on a Mac and `Ctrl+K` on Windows and Linux, and `Mod` alone is the key
/// itself. `Mod` is the same key `useHotkey` listens for, so a label and the
/// hotkey it names always agree.
export const hotkeyLabel = (hotkey: string, platform: Platform): string =>
  formatForDisplay(hotkey, { platform, separatorToken: platform === "mac" ? "" : "+" })

// The platform never changes while the page is open.
const subscribe = () => () => {}

/// `hotkeyLabel` for this computer.
///
/// The server cannot see the keyboard, so a server render shows the Mac label,
/// and the browser puts in its own after hydration.
export function useHotkeyLabel(hotkey: string): string {
  return useSyncExternalStore(
    subscribe,
    () => hotkeyLabel(hotkey, detectPlatform()),
    () => hotkeyLabel(hotkey, "mac"),
  )
}
