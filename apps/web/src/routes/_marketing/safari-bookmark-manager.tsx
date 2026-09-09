import { createFileRoute } from "@tanstack/react-router"

import { appStoreUrl } from "../../components/marketing/store-links"
import { ArticlePage } from "../../pages/article-page"

export const Route = createFileRoute("/_marketing/safari-bookmark-manager")({
  head: () => ({
    meta: [
      { title: "A Bookmark Manager for Safari | Sleevy" },
      { name: "description", content: "Safari bookmarks and Reading List are hard to search and easy to forget. Save links from Safari on iPhone or iPad in one share and find them again anywhere." },
      { property: "og:title", content: "A Bookmark Manager for Safari" },
      { property: "og:description", content: "Save from Safari with the share sheet and keep one searchable queue across your devices." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://sleevy.app/safari-bookmark-manager" },
      { property: "article:modified_time", content: "2026-09-09" },
      { name: "twitter:title", content: "A Bookmark Manager for Safari" },
      { name: "twitter:description", content: "Save from Safari with the share sheet and keep one searchable queue across your devices." },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/safari-bookmark-manager" }],
  }),
  component: () => (
    <ArticlePage
      schema={{ url: "https://sleevy.app/safari-bookmark-manager", datePublished: "2026-09-09" }}
      eyebrow="Safari capture"
      title="A bookmark manager for Safari."
      description="Safari gives you Bookmarks and a Reading List. Neither is easy to search, and neither follows you off Apple's devices. Sleevy takes the link in one share and keeps it in one queue you can reach from anywhere."
      updatedAt={{ dateTime: "2026-09-09", label: "Published September 2026" }}
      primaryAction={{ href: appStoreUrl, label: "Get Sleevy for iPhone and iPad" }}
      secondaryAction={{ href: "/ios-app", label: "How share-sheet capture works", openInNewTab: false }}
      callout={{
        title: "Save with the share sheet",
        body: "Sleevy is a native iPhone and iPad app, not a Safari extension. You tap Share in Safari and choose Sleevy, which is the same action you already use to send a page anywhere else.",
      }}
      comparison={{
        title: "Safari's own tools compared with Sleevy",
        note: "Safari's bookmarks are good at destinations. They are weaker at a backlog you mean to finish.",
        columns: ["What you need", "Safari Bookmarks and Reading List", "Sleevy"],
        rows: [
          { label: "Saving a page you are reading", values: ["Add Bookmark asks for a folder; Reading List does not", "One share, no folder prompt"] },
          { label: "Seeing what a saved link is", values: ["A title and an icon", "Title, site, image, content type, and an optional summary"] },
          { label: "Searching your saved links", values: ["Titles and addresses only", "Titles, sites, types, tags, and summaries"] },
          { label: "Links saved outside Safari", values: ["Stay in whichever browser saved them", "The same queue takes saves from Chrome, Raycast, the web, and scripts"] },
          { label: "Reaching the list on a work machine", values: ["Needs Safari and the same Apple account", "Open the web companion in any browser"] },
        ],
      }}
      sections={[
        {
          title: "Why Safari bookmarks stop being useful",
          paragraphs: [
            "Safari has two places to put a link, and both have a weakness. Add Bookmark wants a folder before it will accept the page, which is a decision you rarely want to make mid-article. Reading List accepts the page instantly, then hides it in a list with no structure, no search worth the name, and no sense of what you have already dealt with.",
            "The result is familiar. Reading List grows into an undated pile, the bookmark folders fill with pages you saved once, and you keep tabs open instead, because at least a tab is visible.",
          ],
        },
        {
          title: "How saving from Safari works",
          paragraphs: [
            "Install Sleevy on your iPhone or iPad and sign in. In Safari, tap the Share button on any page and choose Sleevy. The link is saved immediately and you go back to what you were reading.",
            "The same share sheet works from any app that shares a web address, so a link someone sends you in Messages or a video you find in another app reaches the same queue. You do not need to copy a URL or open Sleevy to file it.",
          ],
        },
        {
          title: "What Sleevy adds after the save",
          paragraphs: [
            "Once a link is in the queue, Sleevy fetches its title, image, favicon, and site name, and works out what kind of content it points at. It can also write a short summary. That is what makes a list of fifty saved links readable a week later, which is the point at which Reading List has usually become unusable.",
            "Folders and tags are available for anything you want to keep, and they stay optional. Nothing is required at the moment you save.",
          ],
        },
        {
          title: "One queue instead of one per browser",
          paragraphs: [
            "Safari bookmarks live in Safari. If you use Safari on your phone and Chrome on a work laptop, you have two collections and no single list of what you meant to read.",
            "Sleevy keeps one queue behind every way of saving into it: the iPhone and iPad share sheet, the Chrome extension, a Raycast command, the web companion, the REST API, and an MCP server for AI agents. Where you saved a link from stops mattering once it is in the queue.",
          ],
        },
        {
          title: "Keep Safari bookmarks for what they are good at",
          paragraphs: [
            "This is not an argument for emptying your bookmarks. Sites you open every week belong on the Safari favourites bar or start page, where one tap reaches them.",
            "Send the other kind of link — the article, the video, the documentation page you will read properly later — to a queue instead. Two tools, two clear jobs.",
          ],
        },
      ]}
      questions={[
        { question: "Is Sleevy a Safari extension?", answer: "No. Sleevy is a native iPhone and iPad app and saves from Safari through the standard iOS share sheet, so there is no browser extension to install or keep updated." },
        { question: "Can I use it with Safari on a Mac?", answer: "There is no Mac Safari extension today. You can open the Sleevy web companion in any desktop browser to read and manage the queue, and you can save from a Mac with the Raycast command." },
        { question: "How is this different from Safari's Reading List?", answer: "Reading List accepts a page quickly but gives you almost nothing to find it again with. Sleevy adds the title, site, image, content type, and an optional summary, and makes all of it searchable." },
        { question: "Will my existing Safari bookmarks move over?", answer: "There is no Safari import today. The recommended approach is to leave frequent sites in Safari and start sending new reading material to Sleevy." },
        { question: "Does it work from apps other than Safari?", answer: "Yes. Any iPhone or iPad app that shares a web address through the standard share sheet can send that link to Sleevy." },
      ]}
      relatedLinks={[
        { href: "/ios-app", label: "Sleevy for iPhone and iPad", openInNewTab: false },
        { href: "/articles/read-later-app-chrome-iphone", label: "One reading queue across Chrome and iPhone", openInNewTab: false },
        { href: "/articles/best-bookmark-manager-chrome", label: "Choosing a bookmark manager for Chrome", openInNewTab: false },
      ]}
      closing={{ title: "Share it once. Find it whenever.", body: "Save from Safari without choosing a folder and keep one searchable queue across every device you read on." }}
    />
  ),
})
