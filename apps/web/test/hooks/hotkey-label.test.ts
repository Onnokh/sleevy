import { describe, expect, test } from "bun:test"

import { hotkeyLabel } from "../../src/hooks/use-hotkey-label"

/// The Web Companion runs on Macs and on PCs, and each keyboard names its own
/// keys. A label that says ⌘ on Windows tells the person to press a key their
/// keyboard does not have.

describe("hotkeyLabel", () => {
  test("names the Mac keys with their symbols, with no separator", () => {
    expect(hotkeyLabel("Mod", "mac")).toBe("⌘")
    expect(hotkeyLabel("Mod+K", "mac")).toBe("⌘K")
    expect(hotkeyLabel("Control", "mac")).toBe("⌃")
  })

  test("names the Windows and Linux keys in words, joined with a plus", () => {
    for (const platform of ["windows", "linux"] as const) {
      expect(hotkeyLabel("Mod", platform)).toBe("Ctrl")
      expect(hotkeyLabel("Mod+K", platform)).toBe("Ctrl+K")
      expect(hotkeyLabel("Mod+V", platform)).toBe("Ctrl+V")
    }
  })

  test("names the Meta key as each keyboard does", () => {
    expect(hotkeyLabel("Meta", "mac")).toBe("⌘")
    expect(hotkeyLabel("Meta", "windows")).toBe("Win")
    expect(hotkeyLabel("Meta", "linux")).toBe("Super")
  })
})
