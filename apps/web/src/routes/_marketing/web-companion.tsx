import { createFileRoute } from "@tanstack/react-router"

import { WebCompanionPage } from "../../pages/web-companion-page"

export const Route = createFileRoute("/_marketing/web-companion")({
  head: () => ({
    meta: [
      { title: "Read-later web app: view and manage saved links | Sleevy" },
      { name: "description", content: "Open the Sleevy web companion to view and manage links saved from iPhone, Chrome, Raycast, and your personal API in one reading queue." },
      { property: "og:title", content: "Sleevy read-later web app" },
      { property: "og:description", content: "View and manage your synced reading queue from any browser." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sleevy.app/web-companion" },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/web-companion" }],
  }),
  component: WebCompanionPage,
})
