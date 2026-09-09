import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "../../pages/home-page"

export const Route = createFileRoute("/_marketing/")({
  head: () => ({
    meta: [
      { title: "Sleevy | Read-It-Later App & Bookmark Manager API" },
      { name: "description", content: "A read-it-later app and personal bookmark manager with a REST API and MCP server. Save links from iPhone, Chrome, Raycast, scripts, or an AI agent into one queue." },
      { property: "og:title", content: "Sleevy | Read-It-Later App & Bookmark Manager API" },
      { property: "og:description", content: "A read-it-later app and bookmark manager with a REST API and MCP server. Save links from iPhone, Chrome, Raycast, scripts, or an AI agent into one queue." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sleevy.app/" },
      { name: "twitter:title", content: "Sleevy | Read-It-Later App & Bookmark Manager API" },
      { name: "twitter:description", content: "A read-it-later app and bookmark manager with a REST API and MCP server. Save links from iPhone, Chrome, Raycast, scripts, or an AI agent into one queue." },
    ],
    links: [
      { rel: "canonical", href: "https://sleevy.app/" },
      // The Markdown twin of this page. The advertised URL really serves
      // Markdown; an alternate that points at HTML is worse than none.
      { rel: "alternate", type: "text/markdown", href: "https://sleevy.app/index.md" },
      // The hero blob layers are CSS background-images, so the browser only
      // discovers them after the stylesheet loads — too late for the first
      // paint they dominate (the back layer is the page's LCP element).
      // Preloading lets them fetch in parallel with the CSS.
      // High priority on the back layer: it is the LCP element, and by default
      // image preloads queue behind the (larger, entrance-delayed) phone image.
      { rel: "preload", as: "image", href: "/hero-blobs-back.avif", fetchPriority: "high" },
      { rel: "preload", as: "image", href: "/hero-blobs-front.avif" },
    ],
  }),
  component: HomePage,
})
