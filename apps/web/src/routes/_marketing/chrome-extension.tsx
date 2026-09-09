import { createFileRoute } from "@tanstack/react-router"

import { chromeStoreUrl } from "../../components/marketing/store-links"
import { IntegrationPage } from "../../pages/integration-page"

export const Route = createFileRoute("/_marketing/chrome-extension")({
  head: () => ({
    meta: [
      { title: "Chrome Bookmark Manager & Read-Later Extension | Sleevy" },
      { name: "description", content: "A Chrome bookmark manager extension that saves tabs for later in one click. No folder to choose, and one synced queue you can reach from any device." },
      { property: "og:title", content: "Chrome Bookmark Manager & Read-Later Extension | Sleevy" },
      { property: "og:description", content: "Save tabs for later in Chrome and keep one synced queue you can search." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sleevy.app/chrome-extension" },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/chrome-extension" }],
  }),
  component: () => (
    <IntegrationPage
      eyebrow="Chrome extension"
      title="A one-click bookmark manager for Chrome."
      description="Save tabs for later in Chrome. The Sleevy bookmark manager extension adds the page you are viewing to one synced read-later queue in a single click."
      intro="Use the Chrome bookmark manager extension to save tabs for later and keep the useful pages you find in one synced queue."
      icon={{ src: "/chrome-76.webp", alt: "Google Chrome", width: 76, height: 82 }}
      primaryAction={{ href: chromeStoreUrl, label: "View in Chrome Web Store" }}
      relatedLinks={[
        { href: "/articles/best-bookmark-manager-chrome", label: "Compare bookmark managers for Chrome" },
        { href: "/articles/how-to-organize-too-many-open-tabs", label: "Learn how to organize too many open tabs" },
      ]}
      benefits={[
        { title: "Save the tab you are reading", body: "Install the Sleevy Chrome extension, connect it to your account, and click the toolbar icon on any normal web page. The extension captures the current URL, so you can close a tab without losing an article, product, documentation page, or reference." },
        { title: "Why use a Chrome read-later extension?", body: "Open tabs are a poor reading queue: they disappear across devices and make it hard to decide what still matters. Sleevy turns a browser tab into a saved item you can revisit later, rather than another thing to keep open." },
        { title: "How is this different from Chrome's bookmark manager?", body: "Chrome's built-in bookmark manager asks which folder a link belongs in before it will accept it, which is the one thing you do not know while you are still reading. Sleevy takes the link first, then adds the title, image, site, and content type itself, so the queue stays readable without you filing anything." },
        { title: "Keep browser research in one place", body: "The Chrome extension adds browser finds to the same personal library as links saved on your phone, through Raycast, or with the Sleevy API. That makes it easier to search your queue and keep a reliable record of things worth returning to." },
        { title: "What happens after I save a tab?", body: "Sleevy stores the URL and its available metadata in your account. You can then read it from the web companion or another connected Sleevy surface whenever you have time." },
      ]}
    />
  ),
})
