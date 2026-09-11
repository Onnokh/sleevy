import { createFileRoute } from "@tanstack/react-router"

import { appStoreUrl } from "../../components/marketing/store-links"
import { ArticlePage } from "../../pages/article-page"

export const Route = createFileRoute("/_marketing/articles_/where-are-my-bookmarks")({
  head: () => ({
    meta: [
      { title: "Where Are My Bookmarks? iPhone, Chrome, and Android | Sleevy" },
      { name: "description", content: "Find your bookmarks on iPhone, in Chrome on desktop, on Android, and in your Google Account, and learn why they keep turning up missing." },
      { property: "og:title", content: "Where are my bookmarks?" },
      { property: "og:description", content: "Find your saved links on every device, and understand why they went missing in the first place." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://sleevy.app/articles/where-are-my-bookmarks" },
    ],
    links: [{ rel: "canonical", href: "https://sleevy.app/articles/where-are-my-bookmarks" }],
  }),
  component: () => (
    <ArticlePage
      schema={{ url: "https://sleevy.app/articles/where-are-my-bookmarks", datePublished: "2026-09-11" }}
      eyebrow="Finding saved links"
      title="Where are my bookmarks?"
      description="How to find your bookmarks on iPhone, in Chrome on a computer, on Android, and in your Google Account, and why the same question keeps coming back."
      updatedAt={{ dateTime: "2026-09-11", label: "Published September 2026" }}
      callout={{
        title: "The short answer",
        body: "In Safari on iPhone, tap the open book icon and choose the first tab. In Chrome on a computer, press Control Shift O on Windows or Command Option B on a Mac. In Chrome on a phone, open the three-dot menu and tap Bookmarks. Bookmarks belong to one browser, so a link saved in another browser will not be there.",
      }}
      sections={[
        {
          title: "Why the question is so common",
          paragraphs: [
            "A bookmark is stored by the browser that saved it. It is not stored by the device and not by your Google or Apple Account in any way you can open directly. That one fact explains almost every case of missing bookmarks: the link is not lost, you are looking in a different browser or a different account from the one that saved it.",
            "Most people use at least two browsers without thinking of it as a choice. Safari on the phone because it is the one the share sheet opens, Chrome on a work laptop because it was already installed, and Edge on a second machine. Each keeps its own separate list.",
          ],
        },
        {
          title: "Where your bookmarks are on iPhone",
          paragraphs: [
            "In Safari, tap the open book icon in the toolbar at the bottom of the screen. Safari opens a panel with three tabs across the top. The first tab, marked with an open book, holds your bookmarks. The middle tab with a pair of glasses is the separate Reading List, which is a common place for saved pages to hide.",
            "If the toolbar is not visible, tap once near the bottom of the screen to bring it back. On older versions of iOS the same icon sits at the top of the screen instead.",
            "In Chrome on an iPhone, bookmarks are somewhere else entirely. Open the three-dot menu and tap Bookmarks. Chrome and Safari on the same phone never share a list.",
          ],
        },
        {
          title: "Where your bookmarks are in Chrome on a computer",
          paragraphs: [
            "Open the Chrome menu, choose Bookmarks and lists, then Bookmark manager. The keyboard shortcut is Control Shift O on Windows and Linux, or Command Option B on a Mac. You can also type chrome://bookmarks in the address bar.",
            "If you were expecting a row of bookmarks under the address bar and it is not there, the bookmarks bar is hidden rather than empty. Press Control Shift B on Windows or Command Shift B on a Mac to show it again.",
            "Bookmarks follow the Chrome profile, not the computer. If Chrome is signed in to a different account from the one that saved the link, you are looking at a different list. Check the profile picture in the top right corner before concluding anything is gone.",
          ],
        },
        {
          title: "Where your bookmarks are on Android",
          paragraphs: [
            "In Chrome on Android, open the three-dot menu at the top right and tap Bookmarks. The list opens with folders, including Mobile bookmarks, which is where links saved on a phone usually land.",
            "Links saved on a desktop appear here only when Chrome is signed in to the same Google Account on both devices and bookmark sync is turned on. Open Settings and then Sync to check.",
            "Samsung Internet and Firefox keep their own separate lists, so a bookmark saved in one of those does not appear in Chrome on the same phone.",
          ],
        },
        {
          title: "Where your bookmarks are in your Google Account",
          paragraphs: [
            "There is no page you can open to browse your bookmarks on the web. The old Google Bookmarks service was closed years ago, so searching for it leads to dead pages and confusing advice.",
            "What your Google Account holds is a synchronised copy used to restore bookmarks into Chrome on another device. To reach them, sign in to Chrome on that device and turn on sync. The bookmarks arrive in the browser, not in a web page.",
            "This is the reason people describe bookmarks as lost after a computer fails. The links survive if sync was on beforehand, and do not if it was not.",
          ],
        },
        {
          title: "Why saved links keep going missing",
          paragraphs: [
            "Each of the answers above is a different place, and that is the actual problem. You have to remember which browser you were using when you saved something in order to know where to look, which is the one detail nobody remembers about a link saved months ago.",
            "A bookmark also carries no record of why you saved it. Even after you find the right list, you are reading a page of titles and guessing which one was the article you wanted.",
          ],
        },
        {
          title: "Keeping one list instead of four",
          paragraphs: [
            "Sleevy keeps saved links outside any browser. You save from the iPhone share sheet, the Chrome extension, Raycast, or the web, and every one of them adds to the same queue. There is only one place to look, whichever device you happen to be holding.",
            "Each saved link arrives with its title, image, and site name, and Sleevy works out whether it is an article or a video and can write a short summary. Searching for the thing you half remember works, because there is something to search.",
            "Keep the browser bookmarks bar for the handful of sites you open every day. That is what it is good at. Everything you save to read or check later belongs somewhere you can find it again.",
          ],
        },
      ]}
      questions={[
        { question: "Where are my bookmarks on my iPhone?", answer: "In Safari, tap the open book icon in the bottom toolbar and choose the first tab. In Chrome on iPhone, open the three-dot menu and tap Bookmarks. The two browsers keep separate lists." },
        { question: "Where are my bookmarks in Chrome?", answer: "Open the Chrome menu, then Bookmarks and lists, then Bookmark manager. The shortcut is Control Shift O on Windows or Command Option B on a Mac." },
        { question: "Where are my bookmarks on my Android phone?", answer: "Open the three-dot menu in Chrome and tap Bookmarks. Links saved on a computer appear only when both devices are signed in to the same Google Account with sync turned on." },
        { question: "How do I see my bookmarks in my Google Account?", answer: "There is no web page for them. Google Bookmarks was discontinued, and your account holds only a synchronised copy that restores into Chrome when you sign in and turn on sync." },
        { question: "Why did my bookmarks disappear?", answer: "Most often they are in another browser or another Chrome profile rather than deleted. Check the profile picture in the top right of Chrome, and check whether you saved the link in a different browser." },
        { question: "Can I get bookmarks back after a computer breaks?", answer: "Yes, if Chrome sync was turned on before the failure. Sign in to Chrome on the new machine and the bookmarks return. Without sync there is no copy to restore." },
      ]}
      relatedLinks={[
        { href: "/articles/export-import-bookmarks", label: "How to export and import bookmarks", openInNewTab: false },
        { href: "/articles/safari-reading-list", label: "Safari Reading List: find it, use it, clear it", openInNewTab: false },
        { href: "/articles/read-later-app-chrome-iphone", label: "A read-later app for Chrome and iPhone", openInNewTab: false },
      ]}
      primaryAction={{ href: appStoreUrl, label: "Get Sleevy for iPhone" }}
      secondaryAction={{ href: "/web-companion", label: "See the web companion", openInNewTab: false }}
      closing={{ title: "One list. Every device.", body: "Save a link from any browser you use and find it again without remembering which one you used." }}
    />
  ),
})
