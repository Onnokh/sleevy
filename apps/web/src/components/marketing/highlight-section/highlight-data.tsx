// PROTOTYPE — throwaway. The two highlights' copy and assets, shared by the
// card-look variants. Only the data is shared; each variant owns its layout.

import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"

import { appStoreUrl, raycastDeeplink } from "../store-links"

export type Highlight = {
  readonly key: "share" | "raycast"
  readonly eyebrow: string
  readonly title: string
  readonly body: ReactNode
  readonly icon: { readonly src: string; readonly alt: string }
  readonly shot: { readonly src: string; readonly alt: string; readonly width: number; readonly height: number }
  readonly cta: { readonly href: string; readonly label: string; readonly glyph: string }
}

export const highlights: readonly Highlight[] = [
  {
    key: "share",
    eyebrow: "iPhone",
    title: "Native Share",
    body: "Hit share in any app, pick Sleevy, and the link is saved. Nothing to copy or paste.",
    icon: { src: "/ios26-82.webp", alt: "Sleevy iPhone app icon" },
    shot: { src: "/share-sheet-750.webp", alt: "iOS share sheet with Sleevy selected", width: 750, height: 906 },
    cta: { href: appStoreUrl, label: "Install on your iPhone", glyph: "/appstore-glyph-96.webp" },
  },
  {
    key: "raycast",
    eyebrow: "Raycast",
    title: "In your workflow",
    body: (
      <>
        Capture and search with the <Link to="/raycast">Raycast link-saving extension</Link> without leaving the
        keyboard.
      </>
    ),
    icon: { src: "/raycast-82.webp", alt: "Raycast extension icon" },
    shot: { src: "/raycast-search-1508.webp", alt: "Searching saved items from Raycast", width: 1508, height: 958 },
    cta: { href: raycastDeeplink, label: "Add to your Raycast", glyph: "/raycast-82.webp" },
  },
]
