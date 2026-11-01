import { createFileRoute } from "@tanstack/react-router"

import { appStoreUrl } from "../../components/marketing/store-links"
import { ArticlePage } from "../../pages/article-page"

export const Route = createFileRoute("/_marketing/articles_/safari-reading-list")({
  head: () => ({
    meta: [
      { title: "Where Is the Safari Reading List in iOS 27? | Sleevy" },
      { name: "description", content: "On iOS 27, open a new tab and tap Reading List on the start page. On a Mac, open the sidebar and click Reading List. Then save pages to it and clear it." },
      { property: "og:title", content: "Where is the Safari Reading List in iOS 27?" },
      { property: "og:description", content: "A complete guide to the Safari Reading List on iPhone and Mac, and where it runs out." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://sleevy.app/articles/safari-reading-list" },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/articles/safari-reading-list" }],
  }),
  component: () => (
    <ArticlePage
      schema={{ url: "https://sleevy.app/articles/safari-reading-list", datePublished: "2026-09-11" }}
      eyebrow="Safari Reading List"
      title="Safari Reading List: find it, use it, clear it."
      description="Where the Reading List lives on iPhone and Mac, how to save pages to it, how to empty it when it grows past reading, and what to do when one browser is no longer where your links belong."
      updatedAt={{ dateTime: "2026-11-01", label: "Updated November 2026 for iOS 27" }}
      callout={{
        title: "The short answer",
        body: "On iPhone with iOS 27, open a new tab and tap Reading List on the start page. If your Safari tabs use the Bottom or Top layout, tap the open book icon, then the glasses tab instead. On Mac, open the sidebar and click Reading List. To empty it, press and hold Clear All Items on iPhone, or right-click any item on Mac and choose Clear All Items.",
      }}
      sections={[
        {
          title: "What the Safari Reading List is",
          paragraphs: [
            "The Reading List is Safari's built-in place to keep a page you intend to read but do not want to read now. It is separate from Bookmarks. A bookmark is a destination you expect to revisit for months, such as a dashboard or a calendar. A Reading List entry is material you plan to read once and then move past.",
            "Safari also downloads the page content when you add an entry, so a saved article can be opened later without a connection. That single feature is why many people use the Reading List as a read-later tool rather than as a bookmark folder.",
            "The Reading List syncs through iCloud, so an entry saved on an iPhone appears in Safari on an iPad and a Mac signed in to the same Apple Account.",
          ],
        },
        {
          title: "Where to find the Reading List on iPhone",
          paragraphs: [
            "Since iOS 26, the place depends on the Safari tab layout, which you choose in Settings, then Apps, then Safari, under Tabs. The Compact layout does not show the open book icon in the toolbar, which is why the Reading List seems to have gone.",
            "On iOS 27 with the Compact layout, go to the start page. Tap the Tabs button, then the plus button to open a new tab, and tap Reading List on the start page.",
            "On iOS 26 with the Compact layout, tap the More button, marked with three dots, then tap Bookmarks, then tap the tab marked with a pair of glasses.",
            "With the Bottom or Top layout, and on iOS 18 and earlier, tap the open book icon in the toolbar, then the tab marked with a pair of glasses. If the panel opens on bookmarks each time, Safari is remembering the last tab you used rather than hiding the list.",
            "The toolbar can be hidden while you scroll. Tap once near the bottom of the screen to bring it back.",
          ],
        },
        {
          title: "Where to find the Reading List on Mac",
          paragraphs: [
            "In Safari on a Mac, click the sidebar button in the toolbar, then click Reading List in the sidebar.",
            "The keyboard shortcut is Control Command 2, or choose View and then Show Reading List Sidebar. Control Command 1 opens bookmarks in the same sidebar, which is a common reason people believe the Reading List has vanished when they have simply landed on the wrong tab.",
          ],
        },
        {
          title: "How to use the Reading List on iPhone",
          paragraphs: [
            "To save the page you are viewing on iOS 27 with the Compact layout, tap the Page Menu button, then Share, then Add to Reading List. With the Bottom or Top layout, tap the share button in the toolbar, then Add to Reading List.",
            "To save a link without opening it first, press and hold the link on the page and choose Add to Reading List. This is the fastest way to work through a page of search results or a newsletter.",
            "Tap any entry to read it. Swipe an entry to the left for Delete, or to the right to mark it as read or unread. Safari can hide entries you have already read: in the Reading List panel, choose Show Unread to see only what is left.",
          ],
        },
        {
          title: "How to clear or delete the Reading List",
          paragraphs: [
            "To remove one entry on iPhone, swipe it to the left and tap Delete. To empty the list completely, open the Reading List, then press and hold the Clear All Items control until the confirmation appears. On some versions of iOS this control appears only after you scroll to the bottom of the list.",
            "On a Mac, right-click any entry in the Reading List sidebar and choose Clear All Items, then confirm. To remove one entry, Control-click it and choose Delete.",
            "Clearing the list also removes the offline copies Safari downloaded, which is the usual reason a full Reading List takes up storage. If you clear it to reclaim space, be aware that anything you had not read yet goes with it and cannot be recovered.",
          ],
        },
        {
          title: "Where the Reading List stops",
          paragraphs: [
            "The Reading List is one flat list with no folders, no tags, and no real search. Once it holds a few hundred entries there is no way to find the article you remember reading except to scroll. Most people clear the whole list rather than sort it, which is why the instructions above are searched so often.",
            "It also lives entirely inside Apple's browser. A link saved in Chrome on a work laptop does not arrive, and a Reading List entry cannot be opened on Android or Windows. If you use Safari on a phone and Chrome on a desktop, you are keeping two lists that do not know about each other.",
            "There is no way to see what a saved entry actually is before you open it. A long investigation, a short recipe, and a video all look the same in the list, so deciding what to read next means opening entries one at a time.",
          ],
        },
        {
          title: "When a separate queue is the better home",
          paragraphs: [
            "If your reading arrives from more than one browser or more than one device, a queue that is not owned by a browser is the simpler answer. Sleevy saves from the iPhone share sheet in one tap, the same way you already add to the Reading List, and the entry lands in a queue you can also reach from Chrome, from the web, and from Raycast.",
            "Sleevy fetches the title, image, and site name for every saved link, works out whether it is an article or a video, and can write a short summary. The list then tells you what each entry is before you open it, which is the decision the Reading List leaves you to make blind.",
            "Keep using the Reading List for what it does well: a handful of pages you will read on the same device within a few days. Send the rest somewhere you can search later.",
          ],
        },
      ]}
      questions={[
        { question: "What is the Reading List in Safari?", answer: "It is Safari's built-in list for pages you want to read later. Unlike a bookmark it downloads the page for offline reading and is meant to be cleared once you have read the entry." },
        { question: "Where is my Reading List on my iPhone?", answer: "On iOS 27, open a new tab in Safari and tap Reading List on the start page. If your tabs use the Bottom or Top layout, tap the open book icon, then the tab marked with a pair of glasses. On iOS 26 with the Compact layout, tap the More button, then Bookmarks, then the glasses tab." },
        { question: "How do I clear the Reading List on iPhone?", answer: "Open the Reading List, then press and hold Clear All Items and confirm. To delete a single entry instead, swipe it to the left and tap Delete." },
        { question: "How do I delete the Reading List in Safari on a Mac?", answer: "Open the sidebar and click Reading List, then right-click any entry and choose Clear All Items. To delete a single entry, Control-click it and choose Delete." },
        { question: "Does the Safari Reading List sync between devices?", answer: "It syncs through iCloud to Safari on any iPhone, iPad, or Mac signed in to the same Apple Account. It does not reach Chrome, Android, or Windows." },
        { question: "What is the difference between the Reading List and bookmarks?", answer: "A bookmark is a destination you expect to return to for months. A Reading List entry is material you intend to read once and then remove." },
        { question: "Can I read Safari Reading List articles offline?", answer: "Yes. Safari downloads the page when you add it, so saved entries open without a connection. Those downloads are also why a long Reading List uses storage." },
      ]}
      relatedLinks={[
        { href: "/safari-bookmark-manager", label: "A bookmark manager for Safari", openInNewTab: false },
        { href: "/articles/read-later-app-chrome-iphone", label: "A read-later app for Chrome and iPhone", openInNewTab: false },
        { href: "/articles/best-read-it-later-apps", label: "The best read-it-later apps", openInNewTab: false },
      ]}
      primaryAction={{ href: appStoreUrl, label: "Get Sleevy for iPhone" }}
      secondaryAction={{ href: "/ios-app", label: "How share-sheet capture works", openInNewTab: false }}
      closing={{ title: "A reading queue that outlives one browser.", body: "Save from Safari in one tap and find the link again from Chrome, the web, or your Mac." }}
    />
  ),
})
