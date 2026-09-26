// PROTOTYPE — throwaway. Shared copy for the header variants: one entry per
// Capture Channel the homepage advertises. Only the data is shared; each
// variant owns its own layout.

import { appStoreUrl, chromeStoreUrl, raycastStoreUrl } from "../store-links"

export type Channel = {
  readonly key: "iphone" | "chrome" | "raycast" | "web" | "api" | "mcp"
  readonly label: string
  /** One short line on how a link gets in through this channel. */
  readonly pitch: string
  /** A link out (store page, docs) or a command to copy. */
  readonly action:
    | { readonly kind: "link"; readonly text: string; readonly href: string }
    | { readonly kind: "copy"; readonly text: string; readonly copy: string }
  /** Beam colour in the prism variant, as linear-ish RGB 0–1. */
  readonly beam: readonly [number, number, number]
}

const curlCapture = `curl https://api.sleevy.app/v1/captures \\
  -H "Authorization: Bearer $SLEEVY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/article","captureChannel":"api"}'`

export const mcpInstall = "npx add-mcp https://api.sleevy.app/mcp --name sleevy"

export const channels: readonly Channel[] = [
  {
    key: "iphone",
    label: "iPhone",
    pitch: "Share any page to Sleevy from the share sheet.",
    action: { kind: "link", text: "Download on the App Store", href: appStoreUrl },
    beam: [1.0, 0.24, 0.3],
  },
  {
    key: "chrome",
    label: "Chrome",
    pitch: "Save the tab you are on with one click.",
    action: { kind: "link", text: "Add Sleevy to Chrome", href: chromeStoreUrl },
    beam: [1.0, 0.56, 0.12],
  },
  {
    key: "raycast",
    label: "Raycast",
    pitch: "Save and search your queue from the keyboard.",
    action: { kind: "link", text: "Install the Raycast extension", href: raycastStoreUrl },
    beam: [0.95, 0.9, 0.2],
  },
  {
    key: "web",
    label: "Web",
    pitch: "Paste a URL into the Web Companion.",
    action: { kind: "link", text: "Open the Web Companion", href: "/web-companion" },
    beam: [0.25, 0.9, 0.45],
  },
  {
    key: "api",
    label: "API",
    pitch: "POST a URL from any script.",
    action: { kind: "copy", text: "POST https://api.sleevy.app/v1/captures", copy: curlCapture },
    beam: [0.2, 0.5, 1.0],
  },
  {
    key: "mcp",
    label: "MCP",
    pitch: "Let your agent save and find links for you.",
    action: { kind: "copy", text: mcpInstall, copy: mcpInstall },
    beam: [0.62, 0.3, 1.0],
  },
]
