import { Link } from "@tanstack/react-router"

import { StructuredData } from "../components/marketing/structured-data"

import styles from "./articles-page.module.scss"

const articles = [
  {
    href: "/articles/export-import-bookmarks",
    title: "How to export and import bookmarks.",
    description: "The exact steps to move bookmarks between Chrome, Safari, Firefox, and Edge, and how to stop repeating the move.",
    dateTime: "2026-09-11",
    date: "September 11, 2026",
    topic: "Bookmark migration",
  },
  {
    href: "/articles/where-are-my-bookmarks",
    title: "Where are my bookmarks?",
    description: "How to find your saved links on iPhone, in Chrome, on Android, and in your Google Account, and why the question keeps coming back.",
    dateTime: "2026-09-11",
    date: "September 11, 2026",
    topic: "Finding saved links",
  },
  {
    href: "/articles/how-to-organize-bookmarks-chrome",
    title: "How to organize bookmarks in Chrome.",
    description: "A method for a bookmark list that has grown past being useful, built around what you will do next rather than what a link is about.",
    dateTime: "2026-09-11",
    date: "September 11, 2026",
    topic: "Bookmark organization",
  },
  {
    href: "/articles/chrome-bookmarks-bar",
    title: "The Chrome bookmarks bar: show, hide, and fix it.",
    description: "One shortcut shows the bar and hides it again, and a bar that has vanished is almost never lost data.",
    dateTime: "2026-09-11",
    date: "September 11, 2026",
    topic: "Chrome bookmarks bar",
  },
  {
    href: "/articles/safari-reading-list",
    title: "Safari Reading List: find it, use it, clear it.",
    description: "Where the Reading List lives on iPhone and Mac, how to save pages to it, how to empty it, and where one browser stops being enough.",
    dateTime: "2026-09-11",
    date: "September 11, 2026",
    topic: "Safari Reading List",
  },
  {
    href: "/articles/best-read-it-later-apps",
    title: "The best read-it-later apps.",
    description: "What separates the read-it-later apps still standing, and how to choose one in five minutes without moving your links twice.",
    dateTime: "2026-09-09",
    date: "September 9, 2026",
    topic: "Read-it-later apps",
  },
  {
    href: "/articles/best-bookmark-manager-chrome",
    title: "A better bookmark manager for Chrome.",
    description: "Chrome ships a bookmark manager and most people outgrow it. What goes wrong, and what a better one does differently.",
    dateTime: "2026-09-09",
    date: "September 9, 2026",
    topic: "Bookmark managers",
  },
  {
    href: "/safari-bookmark-manager",
    title: "A bookmark manager for Safari.",
    description: "Safari Bookmarks and Reading List are hard to search. Save from Safari in one share and keep one queue across your devices.",
    dateTime: "2026-09-09",
    date: "September 9, 2026",
    topic: "Safari capture",
  },
  {
    href: "/articles/how-to-organize-too-many-open-tabs",
    title: "How to organize too many open tabs.",
    description: "Turn a crowded browser window into a short list of clear next steps without treating every tab as an urgent task.",
    dateTime: "2026-08-11",
    date: "August 11, 2026",
    topic: "Open-tab workflow",
  },
  {
    href: "/articles/save-links-with-raycast",
    title: "How to save links with Raycast.",
    description: "Use Raycast to save a URL from your clipboard, search your read-later queue, and reopen saved links without leaving the launcher.",
    dateTime: "2026-07-16",
    date: "July 16, 2026",
    topic: "Raycast read later",
  },
  {
    href: "/articles/read-later-app-chrome-iphone",
    title: "A read-later app for Chrome and iPhone.",
    description: "Save links from Chrome and iPhone to the same synced reading queue, then return to them from either device.",
    dateTime: "2026-07-16",
    date: "July 16, 2026",
    topic: "Cross-device read later",
  },
  {
    href: "/articles/bookmark-manager-for-developers",
    title: "A bookmark manager for developers.",
    description: "Save links from Raycast, Chrome, iPhone, or your own scripts into one personal research queue you can actually come back to.",
    dateTime: "2026-07-16",
    date: "July 16, 2026",
    topic: "Developer workflow",
  },
  {
    href: "/pocket-alternative",
    title: "A simpler home for the links you mean to return to.",
    description: "Looking for a Pocket alternative? Compare a read-later app for saving links from iPhone, Chrome, Raycast, and scripts in one synced queue.",
    dateTime: "2026-07-16",
    date: "July 16, 2026",
    topic: "Pocket alternative",
  },
] as const

export function ArticlesPage() {
  return (
    <article className={styles.page}>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": "https://sleevy.app/articles#collection",
          url: "https://sleevy.app/articles",
          name: "Sleevy articles",
          description: "Articles about saving links from iPhone, Chrome, Raycast, and personal automations.",
          isPartOf: { "@id": "https://sleevy.app/#website" },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: articles.map((article, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: new URL(article.href, "https://sleevy.app").href,
              name: article.title,
            })),
          },
        }}
      />
      <header className={styles.hero}>
        <h1>Articles</h1>
      </header>

      <section className={styles.list} aria-label="Articles">
        {articles.map((article) => (
          <Link key={article.href} className={styles.card} to={article.href}>
            <span className={styles.topic}>{article.topic}</span>
            <h2>{article.title}</h2>
            <p>{article.description}</p>
            <time dateTime={article.dateTime}>{article.date}</time>
            <span className={styles.readMore}>Read article <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </section>
    </article>
  )
}
