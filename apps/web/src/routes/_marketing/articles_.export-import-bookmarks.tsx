import { createFileRoute } from "@tanstack/react-router"

import { chromeStoreUrl } from "../../components/marketing/store-links"
import { ArticlePage } from "../../pages/article-page"

export const Route = createFileRoute("/_marketing/articles_/export-import-bookmarks")({
  head: () => ({
    meta: [
      { title: "How to Export and Import Bookmarks in Chrome | Sleevy" },
      { name: "description", content: "Export bookmarks from Chrome and import them into Chrome, Safari, Firefox, or Edge, with the exact steps for each browser pair." },
      { property: "og:title", content: "How to export and import bookmarks" },
      { property: "og:description", content: "Move your bookmarks between Chrome, Safari, Firefox, and Edge without losing the folders." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://sleevy.app/articles/export-import-bookmarks" },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/articles/export-import-bookmarks" }],
  }),
  component: () => (
    <ArticlePage
      schema={{ url: "https://sleevy.app/articles/export-import-bookmarks", datePublished: "2026-09-11" }}
      eyebrow="Moving bookmarks"
      title="How to export and import bookmarks."
      description="The exact steps to move bookmarks out of Chrome and into Chrome, Safari, Firefox, or Edge, what the export file actually contains, and how to stop repeating the move."
      updatedAt={{ dateTime: "2026-09-11", label: "Published September 2026" }}
      callout={{
        title: "The short answer",
        body: "In Chrome, open the Bookmark manager with Control Shift O on Windows or Command Option B on a Mac, open the three-dot menu inside it, and choose Export bookmarks. That produces one HTML file, and every major browser can import that same file.",
      }}
      sections={[
        {
          title: "How to export bookmarks from Chrome",
          paragraphs: [
            "Open the Chrome menu, choose Bookmarks and lists, then Bookmark manager. The shortcut is Control Shift O on Windows and Linux, or Command Option B on a Mac.",
            "Inside the Bookmark manager there is a second three-dot menu at the top right, separate from Chrome's own menu. Open it and choose Export bookmarks. Chrome saves an HTML file wherever you tell it to, named for the date by default.",
            "The export covers every bookmark in the profile you are signed in to, with the folder structure intact. It does not include your history, passwords, or open tabs, and it does not include anything saved in a different Chrome profile.",
          ],
        },
        {
          title: "How to import bookmarks into Chrome",
          paragraphs: [
            "There are two routes and they do different things. In the Bookmark manager, the same three-dot menu holds Import bookmarks, which reads an HTML file you already have.",
            "The other route reads directly from another browser installed on the same computer. Open Chrome settings, choose Import bookmarks and settings, then pick the browser in the list. This is the faster option when both browsers are on the machine in front of you, because you never handle a file.",
            "Imported bookmarks arrive in a new folder, usually called Imported or Imported from, rather than merging into your existing folders. That is deliberate, and it keeps a failed import easy to undo: delete the one folder.",
          ],
        },
        {
          title: "Chrome to Safari",
          paragraphs: [
            "Export from Chrome first using the steps above. Then open Safari on the Mac, choose File, then Import From, then Bookmarks HTML File, and select the file you saved.",
            "Safari can also read Chrome directly. Choose File, then Import From, then Google Chrome, and Safari offers bookmarks and history from the Chrome profile on that Mac.",
            "Imported links land in a folder named Imported at the bottom of your Safari bookmarks. Move what you want onto the Favorites bar afterwards, because the import will not place anything there for you.",
          ],
        },
        {
          title: "Chrome to Firefox",
          paragraphs: [
            "In Firefox, open the Bookmarks menu and choose Manage bookmarks, or press Control Shift O on Windows and Command Shift O on a Mac. That opens the window Firefox calls the Library.",
            "In the Library, open the Import and Backup menu. Choose Import Bookmarks from HTML to read a Chrome export file, or choose Import Data from Another Browser to read Chrome directly from the same computer.",
            "Firefox places the imported links in a folder called From Google Chrome inside the Bookmarks Menu. The Bookmarks Toolbar stays as it was.",
          ],
        },
        {
          title: "Edge to Chrome",
          paragraphs: [
            "This pair does not need a file at all. Open Chrome settings, choose Import bookmarks and settings, then choose Microsoft Edge from the list. Chrome reads the Edge profile on the same computer directly.",
            "Tick only Favourites or bookmarks if you want the links without the browsing history and saved passwords. Chrome selects everything it can read by default.",
            "If Edge is on a different machine, export from Edge first: open the Edge menu, choose Favourites, then the three-dot menu inside that panel, then Export favourites. Edge writes the same kind of HTML file that Chrome reads.",
          ],
        },
        {
          title: "What is actually in the export file",
          paragraphs: [
            "The file every browser writes and reads is a plain HTML document holding a nested list of links, with folders as nested lists and a saved date on each entry. You can open it in any browser to read it, and the links work.",
            "Because it is only a list of addresses, nothing else survives the move. A page that has since been taken down imports as a dead link, and nothing in the file records why you saved any of it.",
            "Keeping the file somewhere safe after an export is worthwhile. It is the only copy of your bookmarks that does not depend on a browser still working.",
          ],
        },
        {
          title: "Why this task keeps coming back",
          paragraphs: [
            "Exporting and importing is a symptom. Bookmarks belong to a browser, so changing browser, changing job, or changing computer means moving them again, and every move leaves another Imported folder behind.",
            "Sleevy keeps saved links outside the browser instead. The Chrome extension saves the page you are on in one click, the iPhone share sheet and Raycast add to the same queue, and the web companion opens the same list on a machine where nothing is installed.",
            "That does not replace the bookmarks bar. Keep the sites you open daily where they are. Move the reading and the research to a list that does not have to be exported the next time you switch.",
          ],
        },
      ]}
      questions={[
        { question: "How do I export bookmarks from Chrome?", answer: "Open the Bookmark manager with Control Shift O or Command Option B, open the three-dot menu inside the manager, and choose Export bookmarks. Chrome saves one HTML file containing every bookmark in that profile." },
        { question: "How do I import bookmarks into Chrome?", answer: "Use Import bookmarks in the Bookmark manager's three-dot menu to read an HTML file, or use Import bookmarks and settings in Chrome settings to read another browser on the same computer." },
        { question: "How do I move bookmarks from Chrome to Safari?", answer: "Export an HTML file from Chrome, then in Safari choose File, Import From, Bookmarks HTML File. Safari can also read Chrome directly through File, Import From, Google Chrome." },
        { question: "How do I import Chrome bookmarks into Firefox?", answer: "Open the Firefox Library with Control Shift O or Command Shift O, open Import and Backup, and choose either Import Bookmarks from HTML or Import Data from Another Browser." },
        { question: "How do I import bookmarks from Edge to Chrome?", answer: "Open Chrome settings, choose Import bookmarks and settings, and select Microsoft Edge. No file is needed when both browsers are on the same computer." },
        { question: "Will importing bookmarks create duplicates?", answer: "Importing the same file twice does create a second copy, because each import adds a new folder rather than merging. Delete the extra Imported folder to undo it." },
        { question: "Do bookmarks keep their folders when exported?", answer: "Yes. The HTML file stores folders as nested lists, so the structure survives the move. Saved dates survive too. Nothing else does." },
      ]}
      relatedLinks={[
        { href: "/articles/where-are-my-bookmarks", label: "Where are my bookmarks?", openInNewTab: false },
        { href: "/articles/how-to-organize-bookmarks-chrome", label: "How to organize bookmarks in Chrome", openInNewTab: false },
        { href: "/articles/best-bookmark-manager-chrome", label: "A better bookmark manager for Chrome", openInNewTab: false },
      ]}
      primaryAction={{ href: chromeStoreUrl, label: "Get the Sleevy Chrome extension" }}
      secondaryAction={{ href: "/articles/best-bookmark-manager-chrome", label: "Compare bookmark managers", openInNewTab: false }}
      closing={{ title: "Export once. Then stop exporting.", body: "Keep the links you want to return to somewhere that does not belong to a single browser." }}
    />
  ),
})
