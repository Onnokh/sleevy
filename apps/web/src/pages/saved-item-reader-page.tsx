import { useCallback, useEffect, useRef } from "react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router"
import clsx from "clsx"

import { useSavedItems } from "../sleevy/saved-items"
import { useFolders } from "../sleevy/folders"
import { hasReaderView } from "../sleevy/reader-destination"
import { useScrollEdges } from "../hooks/use-scroll-edges"
import { useKeyboardNav } from "../contexts/keyboard-nav-context"
import { faviconUrl } from "../components/saved-card/saved-card"
import { PageTitleBar } from "../components/ui/page-title-bar/page-title-bar"
import { ReaderPage } from "./reader-page"
import styles from "./reader-layout.module.scss"

/**
 * The blank run-out below the last row, matching $list-run-out in the
 * stylesheet. Needed here because the last rows have to close the gap to the
 * real end of the list rather than stop as soon as they are visible.
 */
const LIST_RUN_OUT = 64

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * The Reader View with the list beside it, which with the app sidebar makes
 * three panes. The list is the same Saved Items the Inbox shows, restricted to
 * the ones that have a Reader View, so every row in it leads somewhere.
 *
 * The active item travels down as a prop because the list already holds it: a
 * post is rendered from that record and needs no second request.
 */
export function SavedItemReaderPage() {
  const { savedItemId } = useParams({ from: "/_app/read/$savedItemId" })
  const { folder } = useSearch({ from: "/_app/read/$savedItemId" })
  const navigate = useNavigate()
  const router = useRouter()
  // The list is the Folder the reader opened the article from, so moving to the
  // next one stays inside that Folder rather than wandering the whole library.
  // eslint-disable-next-line react-doctor/no-event-handler
  const savedItemsQuery = useSavedItems("newest", folder)
  // Every Saved Item, only to resolve the open one. A post is drawn from its
  // list record, so an article that has left the Folder it was opened from —
  // moved, or reached by a stale link — would otherwise render nothing at all.
  // The Inbox and the sidebar already hold this query, so it costs no request.
  const allItemsQuery = useSavedItems()
  const foldersQuery = useFolders()
  const { claimListKeys } = useKeyboardNav()
  const activeRef = useRef<HTMLButtonElement>(null)
  // Set when a key moved the selection, so the row takes focus only then. A
  // navigation that came from the mouse leaves focus where the reader put it.
  const movedByKeyRef = useRef(false)
  const listRef = useRef<HTMLElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const listEdges = useScrollEdges(listRef)
  const paneEdges = useScrollEdges(paneRef)

  const readable = (savedItemsQuery.data?.savedItems ?? []).filter(hasReaderView)
  const active =
    readable.find((item) => item.id === savedItemId)
    ?? allItemsQuery.data?.savedItems.find((item) => item.id === savedItemId)

  // What the list is showing. It is a Library surface whatever it was opened
  // from: the Inbox is the triage surface for *unread* Saved Items, and this
  // list keeps the read ones too, which is the Library's job — read Saved Items
  // leave the Inbox and stay in the Library. Naming it "Inbox" promised a set
  // it does not hold, and the rows a reader knew from the Inbox turned up in
  // unfamiliar places with read ones between them.
  //
  // The No Folder Filter has no user-facing label of its own, so the unfiled
  // root is simply the Library too. Only a Folder View is named, after its
  // Folder — and a Folder still loading has no name yet, so the title waits
  // rather than guessing.
  const folderName = foldersQuery.data?.folders.find((candidate) => candidate.id === folder)?.name
  const scopeTitle = folder && folder !== "none" ? folderName : "Library"

  const openAt = useCallback((id: string) => {
    void navigate({
      to: "/read/$savedItemId",
      params: { savedItemId: id },
      // The scope stays as the reader moves down the list, or the next article
      // would arrive beside the whole library again.
      search: folder ? { folder } : {},
    })
  }, [folder, navigate])

  /**
   * One step through the list. In the Reader View the list and the article are
   * the same choice, so a step opens rather than only pointing: there is no
   * second key to press. It stops at both ends rather than wrapping — an
   * article silently reappearing from the far end reads as a bug.
   */
  const step = useCallback((delta: number) => {
    const index = readable.findIndex((item) => item.id === savedItemId)
    if (index < 0) return
    const next = readable[index + delta]
    if (!next) return
    movedByKeyRef.current = true
    openAt(next.id)
  }, [openAt, readable, savedItemId])

  // j and k reach the list from anywhere on the page, the way they do on every
  // other list in the app (ADR 0010). The page owns them while it is open, so
  // the global pair stops moving a cursor that is not on screen here.
  useEffect(() => {
    claimListKeys(true)
    return () => claimListKeys(false)
  }, [claimListKeys])

  useHotkey("J", () => step(1))
  useHotkey("K", () => step(-1))

  // The arrows are scoped to the list itself. Left on the page they would take
  // the arrow keys away from the article, which is the one thing in the Reader
  // View that most needs to scroll.
  useHotkey("ArrowDown", () => step(1), { target: listRef })
  useHotkey("ArrowUp", () => step(-1), { target: listRef })

  /**
   * Moving between articles should not leave the current one off-screen, and a
   * move made with the keyboard keeps the keyboard on the list so the next
   * arrow has somewhere to go.
   *
   * Driven by the router's own render event rather than by an effect on the
   * article id. The router restores the scroll offset of every nested container
   * it tracks, and this list is one of them: measured, the effect put the list
   * at the right offset and the router wrote the previous article's offset over
   * it 20ms later, every time. Subscribers run in the order they were added and
   * the router's restore is set up with the router itself, so this one runs
   * after it and has the last word.
   */
  useEffect(() => {
    const position = () => {
      activeRef.current?.scrollIntoView({ block: "nearest" })

      // The run-out below the last row is deeper than the clearance a row asks
      // for, so the final rows come to rest a little short of the true end —
      // and the bottom ramp, which only takes itself away at the true end,
      // stays over them. Reaching the last article should reach the end of the
      // list, so the remaining sliver is closed.
      const list = listRef.current
      if (list) {
        const remaining = list.scrollHeight - list.clientHeight - list.scrollTop
        if (remaining > 0 && remaining <= LIST_RUN_OUT) list.scrollTop = list.scrollHeight
      }

      if (movedByKeyRef.current) {
        movedByKeyRef.current = false
        activeRef.current?.focus({ preventScroll: true })
      }
    }

    // The first article is arrived at rather than navigated to, so it gets no
    // render event of its own.
    position()
    return router.subscribe("onRendered", position)
  }, [router])

  return (
    <div className={styles.split}>
      <nav className={styles.list} aria-label="Articles" ref={listRef}>
        <div
          className={clsx(styles.listFade, styles.listFadeTop)}
          data-hidden={listEdges.atStart || undefined}
          aria-hidden="true"
        >
          <div className={styles.listFadeTopSurface} />
        </div>

        {/* The column's own pinned title, the same one every page has: the
            heading below is the large title, this takes over once it scrolls
            away. It goes by the column's scroll position rather than by
            watching that heading, which sits too near the top edge for the
            observer's band to read. */}
        {scopeTitle ? (
          <>
            <PageTitleBar title={scopeTitle} show={!listEdges.atStart} />
            <h2 className={styles.listTitle}>{scopeTitle}</h2>
          </>
        ) : null}

        {readable.map((item) => (
          <button
            key={item.id}
            type="button"
            ref={item.id === savedItemId ? activeRef : undefined}
            className={clsx(styles.row, item.id === savedItemId && styles.rowActive)}
            onClick={() => openAt(item.id)}
          >
            <span className={styles.rowTitle}>{item.title ?? hostOf(item.originalUrl)}</span>
            <span className={styles.rowMeta}>
              <img className={styles.rowFavicon} src={faviconUrl(item.host)} alt="" />
              {hostOf(item.originalUrl)}
            </span>
          </button>
        ))}
        <div
          className={clsx(styles.listFade, styles.listFadeBottom)}
          data-hidden={listEdges.atEnd || undefined}
          aria-hidden="true"
        >
          <div className={styles.listFadeBottomSurface} />
        </div>
      </nav>

      {/* A new article starts at its own beginning. The pane is one scroll
          container reused for every article, and the router would otherwise
          carry the last one's offset over — see scrollToTopSelectors in
          router.tsx, which is what reads this attribute. */}
      <div className={styles.pane} ref={paneRef} data-scroll-to-top>
        <ReaderPage savedItemId={savedItemId} item={active} scrollParent={paneRef} />
        <div
          className={styles.bottomFade}
          data-hidden={paneEdges.atEnd || undefined}
          aria-hidden="true"
        >
          <div className={styles.bottomFadeSurface} />
        </div>
      </div>
    </div>
  )
}
