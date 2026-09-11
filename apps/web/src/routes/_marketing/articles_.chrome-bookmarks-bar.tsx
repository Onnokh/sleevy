import { createFileRoute } from "@tanstack/react-router"

import { chromeStoreUrl } from "../../components/marketing/store-links"
import { ArticlePage } from "../../pages/article-page"

export const Route = createFileRoute("/_marketing/articles_/chrome-bookmarks-bar")({
  head: () => ({
    meta: [
      { title: "Chrome Bookmarks Bar: Show, Hide, and Fix It | Sleevy" },
      { name: "description", content: "Show or hide the Chrome bookmarks bar with one shortcut, add links to it, and get it back when it disappears." },
      { property: "og:title", content: "The Chrome bookmarks bar: show, hide, and fix it" },
      { property: "og:description", content: "One shortcut shows it, the same shortcut hides it, and a missing bar is almost never lost data." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://sleevy.app/articles/chrome-bookmarks-bar" },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/articles/chrome-bookmarks-bar" }],
  }),
  component: () => (
    <ArticlePage
      schema={{ url: "https://sleevy.app/articles/chrome-bookmarks-bar", datePublished: "2026-09-11" }}
      eyebrow="Chrome bookmarks bar"
      title="The Chrome bookmarks bar: show, hide, and fix it."
      description="How to show and hide the bar with one shortcut, add links to it, keep it to a single row, and get it back when it disappears."
      updatedAt={{ dateTime: "2026-09-11", label: "Published September 2026" }}
      callout={{
        title: "The short answer",
        body: "Press Control Shift B on Windows and Linux, or Command Shift B on a Mac. The same shortcut shows the bar and hides it again. A bar that has vanished is almost always hidden rather than deleted.",
      }}
      sections={[
        {
          title: "How to show the bookmarks bar in Chrome",
          paragraphs: [
            "The keyboard shortcut is Control Shift B on Windows and Linux, and Command Shift B on a Mac. It is a toggle, so pressing it again hides the bar.",
            "Through the menu: open the Chrome menu, choose Bookmarks and lists, then Show bookmarks bar. The same entry carries a tick when the bar is already visible.",
            "The bar always appears on the New Tab page, even when it is hidden everywhere else. Seeing it on a new tab and nowhere else is the normal behaviour rather than a fault.",
          ],
        },
        {
          title: "How to hide or remove the bookmarks bar",
          paragraphs: [
            "Use the same shortcut, Control Shift B or Command Shift B, or clear the tick on Show bookmarks bar in the Bookmarks and lists menu.",
            "Hiding the bar never deletes anything. The bookmarks remain in the Bookmark manager, reachable with Control Shift O on Windows or Command Option B on a Mac.",
            "Chrome has no setting to hide the bar on the New Tab page while keeping it elsewhere, and no setting to move it below the tab strip. Those are the two requests behind most of the searching on this subject, and neither is available.",
          ],
        },
        {
          title: "When the bookmarks bar has disappeared",
          paragraphs: [
            "Work through three causes in order. First, the bar is hidden: press the shortcut. Second, the window is in full screen, which hides the bar along with the rest of the browser interface: leave full screen and check again. Third, and most often when the bar is visible but empty, Chrome is signed in to a different profile.",
            "Check the profile picture at the top right corner of the window. Each Chrome profile carries its own separate bookmarks, so signing in to the wrong one shows a bar that is genuinely empty while your links are untouched in the other profile.",
            "If the bar is present in one profile and the links are still missing, open the Bookmark manager and look in Other bookmarks. Links saved without a folder land there rather than on the bar.",
          ],
        },
        {
          title: "How to add a link to the bookmarks bar",
          paragraphs: [
            "With the page open, click the star at the right of the address bar and choose Bookmarks bar as the folder. You can also drag the padlock or icon at the left of the address bar straight down onto the bar.",
            "To move a bookmark that is already saved, open the Bookmark manager and drag it into the Bookmarks bar folder in the left column.",
            "Right-click the bar and choose Add page to save the current page, or Add folder to create a group that opens as a short menu.",
          ],
        },
        {
          title: "Keeping the bar to one row",
          paragraphs: [
            "The bar holds far more than it looks, because the width of each entry comes from its name rather than the site. Right-click a bookmark, choose Edit, and shorten the name, or clear it completely to leave only the site icon.",
            "Folders on the bar hold the rest. A folder of six related sites takes the space of one entry and opens as a menu.",
            "Keep the bar for sites you open regularly. Anything you saved to read once does not belong there, and it is what pushes the bar past one row in the first place.",
          ],
        },
        {
          title: "What the bar is not for",
          paragraphs: [
            "The bookmarks bar is a set of shortcuts to places you go. It is not a reading list, and using it as one is why it overflows and why the links on it stop meaning anything.",
            "Sleevy holds the other kind of saved link. The Chrome extension saves the page you are on in one click with no folder prompt, and the same queue is reachable from the iPhone share sheet, Raycast, and the web. Saved links arrive with their title, image, and site name, so the list is readable weeks later.",
            "Keep the destinations on the bar. Send the reading somewhere it can wait without taking up space you look at all day.",
          ],
        },
      ]}
      questions={[
        { question: "How do I show the bookmarks bar in Chrome?", answer: "Press Control Shift B on Windows or Command Shift B on a Mac, or open the Chrome menu and choose Bookmarks and lists, then Show bookmarks bar." },
        { question: "How do I hide the Chrome bookmarks bar?", answer: "Press the same shortcut again, Control Shift B or Command Shift B. Hiding the bar does not delete any bookmarks." },
        { question: "Why did my Chrome bookmarks bar disappear?", answer: "It is usually hidden, the window is in full screen, or Chrome is signed in to a different profile. Check the profile picture at the top right, because each profile has its own bookmarks." },
        { question: "Why does the bookmarks bar only show on the New Tab page?", answer: "That is how Chrome behaves when the bar is hidden. It always appears on the New Tab page. Turn it on properly to see it on every page." },
        { question: "How do I add a page to the bookmarks bar?", answer: "Click the star in the address bar and choose Bookmarks bar as the folder, or drag the icon at the left of the address bar down onto the bar." },
        { question: "Can I move the Chrome bookmarks bar to the bottom of the screen?", answer: "No. Chrome does not offer a setting to reposition the bar, and it cannot be hidden on the New Tab page separately." },
      ]}
      relatedLinks={[
        { href: "/articles/how-to-organize-bookmarks-chrome", label: "How to organize bookmarks in Chrome", openInNewTab: false },
        { href: "/articles/where-are-my-bookmarks", label: "Where are my bookmarks?", openInNewTab: false },
        { href: "/chrome-extension", label: "Save tabs with the Sleevy Chrome extension", openInNewTab: false },
      ]}
      primaryAction={{ href: chromeStoreUrl, label: "Get the Sleevy Chrome extension" }}
      secondaryAction={{ href: "/articles/how-to-organize-too-many-open-tabs", label: "Too many tabs open?", openInNewTab: false }}
      closing={{ title: "A bar you can read at a glance.", body: "Keep the daily sites on the bar and give everything else a queue of its own." }}
    />
  ),
})
