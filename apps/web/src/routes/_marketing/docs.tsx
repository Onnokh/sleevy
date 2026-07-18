import { createFileRoute } from "@tanstack/react-router"
import { DocsPage } from "../../pages/docs-page"

export const Route = createFileRoute("/_marketing/docs")({
  head: () => ({
    meta: [
      { title: "Sleevy API & MCP Documentation" },
      { name: "description", content: "Use the Sleevy REST API or Model Context Protocol server to save URLs, organize saved links, and manage a personal reading queue." },
      { property: "og:title", content: "Sleevy API & MCP Documentation" },
      { property: "og:description", content: "Save URLs and manage your reading queue with the Sleevy REST API or MCP server." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sleevy.app/docs" },
      { name: "twitter:title", content: "Sleevy API & MCP Documentation" },
      { name: "twitter:description", content: "Save URLs and manage your reading queue with the Sleevy REST API or MCP server." },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/docs" }],
  }),
  component: DocsPage,
})
