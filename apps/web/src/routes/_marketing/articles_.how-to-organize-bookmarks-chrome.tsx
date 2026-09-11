import { createFileRoute } from "@tanstack/react-router"

import { chromeStoreUrl } from "../../components/marketing/store-links"
import { ArticlePage } from "../../pages/article-page"

export const Route = createFileRoute("/_marketing/articles_/how-to-organize-bookmarks-chrome")({
  head: () => ({
    meta: [
      { title: "How to Organize Bookmarks in Chrome | Sleevy" },
      { name: "description", content: "Sort a crowded Chrome bookmarks list into folders you will actually use, and learn which saved links do not belong in bookmarks at all." },
      { property: "og:title", content: "How to organize bookmarks in Chrome" },
      { property: "og:description", content: "A method for a bookmark list that has grown past the point of being useful." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://sleevy.app/articles/how-to-organize-bookmarks-chrome" },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/articles/how-to-organize-bookmarks-chrome" }],
  }),
  component: () => (
    <ArticlePage
      schema={{ url: "https://sleevy.app/articles/how-to-organize-bookmarks-chrome", datePublished: "2026-09-11" }}
      eyebrow="Bookmark organization"
      title="How to organize bookmarks in Chrome."
      description="A method for a bookmark list that has grown past being useful, built around what you will do with each link rather than what it is about."
      updatedAt={{ dateTime: "2026-09-11", label: "Published September 2026" }}
      callout={{
        title: "Sort by next action first",
        body: "Split the list into sites you open regularly and material you meant to read. Only the first group belongs in bookmarks. Sorting the second group into topic folders is the work that never finishes.",
      }}
      sections={[
        {
          title: "Why topic folders stop working",
          paragraphs: [
            "Most bookmark lists start as folders by subject: work, recipes, travel, reading. The structure looks right and fails quietly, because a link has to be filed at the moment you save it, which is the moment you know least about it.",
            "The result is a folder named Reading holding four hundred links, and a habit of saving into the top level instead because choosing a folder takes longer than closing the tab.",
            "A list organized by what you will do next survives contact with real use. There are only a few possible next actions, and you know which one applies without thinking.",
          ],
        },
        {
          title: "Open the Bookmark manager",
          paragraphs: [
            "Open the Chrome menu, choose Bookmarks and lists, then Bookmark manager, or press Control Shift O on Windows and Command Option B on a Mac. You can also go straight to chrome://bookmarks.",
            "The manager gives you the full list with folders on the left. Drag entries between folders, right-click a folder and choose Add new folder to create one, and right-click a folder and choose Sort by name to order its contents alphabetically.",
            "Use the search box at the top before you start moving anything. Searching for a word you remember tells you quickly how many entries you no longer recognize at all.",
          ],
        },
        {
          title: "Make one pass and keep it short",
          paragraphs: [
            "Work through the list once and give every entry one of three outcomes. Keep it as a destination if you open it at least once a month. Move it to a reading queue if you saved it to read and have not. Delete it if neither is true.",
            "Do not try to improve the folder names while you do this. One pass with three outcomes takes an evening. A redesign of the folder structure takes a weekend and leaves you with the same problem in a neater arrangement.",
            "Anything you cannot decide about in a few seconds belongs in the delete group. A link you cannot place is a link you will not return to.",
          ],
        },
        {
          title: "Put the daily sites on the bookmarks bar",
          paragraphs: [
            "The destinations that survive the pass belong on the bookmarks bar, where they are one click away. Press Control Shift B on Windows or Command Shift B on a Mac to show it if it is hidden.",
            "Keep the bar to a single row. Right-click a bookmark, choose Edit, and shorten the name to a word or two, or clear the name completely to leave only the site icon. A bar of icons holds far more than a bar of full page titles.",
            "Group related sites into a folder on the bar when one row is not enough. A folder on the bar opens as a short menu, which is still faster than opening the manager.",
          ],
        },
        {
          title: "Reading material does not belong in bookmarks",
          paragraphs: [
            "The second group is the reason the list grew. Articles, documentation, videos, and research are saved once and read once, and they need a queue rather than a filing system.",
            "A bookmark shows a title and nothing else. Weeks later a page of titles is not enough to decide what to open, so nothing gets opened, and the folder grows.",
            "Sleevy takes that group. The Chrome extension saves the page you are on in one click with no folder prompt, and the same queue accepts links from the iPhone share sheet, Raycast, the web companion, and the API. Every saved link arrives with its title, image, and site name, sorted into an article or a video, and can carry a short summary, so the list tells you what each entry is before you open it.",
          ],
        },
        {
          title: "Keeping the list tidy afterwards",
          paragraphs: [
            "Once the two groups are separated, the bookmarks list stops growing, because the thing that was filling it now goes somewhere else. A destination is added a few times a year.",
            "Check the bar every few months and remove what you no longer open. That is the whole maintenance cost of a list organized by next action rather than by subject.",
          ],
        },
      ]}
      questions={[
        { question: "How do I organize bookmarks in Chrome?", answer: "Open the Bookmark manager with Control Shift O or Command Option B, then make one pass and give every entry one outcome: keep it as a destination, move it to a reading queue, or delete it. Sort by next action rather than by topic." },
        { question: "How do I create a bookmark folder in Chrome?", answer: "In the Bookmark manager, right-click a folder in the left column and choose Add new folder. You can also right-click directly on the bookmarks bar." },
        { question: "How do I sort Chrome bookmarks alphabetically?", answer: "Right-click a folder in the Bookmark manager and choose Sort by name. It sorts the contents of that folder only, not the whole list." },
        { question: "How many bookmarks is too many?", answer: "There is no technical limit, but a bar you cannot scan at a glance has stopped working. The useful measure is whether you can find a link faster than searching the web for it again." },
        { question: "Should I delete old bookmarks?", answer: "Yes. A link you cannot place within a few seconds is one you will not return to, and keeping it makes the rest harder to see." },
      ]}
      relatedLinks={[
        { href: "/articles/how-to-organize-too-many-open-tabs", label: "How to organize too many open tabs", openInNewTab: false },
        { href: "/articles/best-bookmark-manager-chrome", label: "A better bookmark manager for Chrome", openInNewTab: false },
        { href: "/articles/export-import-bookmarks", label: "How to export and import bookmarks", openInNewTab: false },
      ]}
      primaryAction={{ href: chromeStoreUrl, label: "Get the Sleevy Chrome extension" }}
      secondaryAction={{ href: "/articles/where-are-my-bookmarks", label: "Cannot find a saved link?", openInNewTab: false }}
      closing={{ title: "Destinations on the bar. Reading in a queue.", body: "Separate the two once and the bookmark list stops growing on its own." }}
    />
  ),
})
