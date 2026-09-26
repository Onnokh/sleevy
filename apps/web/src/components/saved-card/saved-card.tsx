import { type ReactNode, useRef } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import clsx from "clsx"
import { differenceInHours, differenceInMinutes, format } from "date-fns"
import { ExternalLink, MoreVertical } from "lucide-react"

import { type FolderSelector, type SavedItem } from "../../sleevy/saved-items"
import { hasReaderView } from "../../sleevy/reader-destination"
import { useReaderViewDisabled } from "../../sleevy/reader-preference"
import { SAVED_ITEM_DRAG_TYPE, useFolders, useMoveSavedItemToFolder } from "../../sleevy/folders"
import { ContextMenu, type ContextMenuItem } from "../ui/context-menu/context-menu"
import styles from "./saved-card.module.scss"

type Props = {
  readonly item: SavedItem
  /** The Folder this list is showing, carried into the Reader View's own list. */
  readonly folder?: FolderSelector
  readonly isSelected?: boolean
  readonly pendingDelete?: boolean
  readonly onDelete: (id: string) => void
  readonly onOpen: (id: string) => void
  readonly onSetReadState: (id: string, isRead: boolean) => void
}

export function faviconUrl(host: string) {
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${host}&size=64`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const now = new Date()
  const minutes = differenceInMinutes(now, date)
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`

  const hours = differenceInHours(now, date)
  if (hours < 24) return `${hours}h`

  return format(date, date.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy")
}

/**
 * The Open Action's two destinations, as real links rather than click handlers:
 * a Saved Item with a Reader View opens it, one without goes to its Original
 * URL. Keeping both as anchors is what lets cmd-click and
 * middle-click keep working in a keyboard-first client.
 */
function CardLink({
  item,
  folder,
  readsHere,
  className,
  title,
  onOpen,
  children,
}: {
  readonly item: SavedItem
  readonly folder?: FolderSelector
  /** Whether opening this card stays in the Reader View. */
  readonly readsHere: boolean
  readonly className: string
  readonly title?: string | undefined
  readonly onOpen: () => void
  readonly children: ReactNode
}) {
  if (readsHere) {
    return (
      <Link
        className={className}
        to="/read/$savedItemId"
        params={{ savedItemId: item.id }}
        // The scope rides in the link itself, so cmd-click opens the Reader
        // View on the same Folder the card was clicked in.
        search={folder ? { folder } : {}}
        title={title}
        onClick={onOpen}
      >
        {children}
      </Link>
    )
  }

  return (
    <a
      className={className}
      href={item.originalUrl}
      target="_blank"
      rel="noreferrer"
      title={title}
      onClick={onOpen}
    >
      {children}
    </a>
  )
}

export function SavedCard({ item, folder, isSelected, pendingDelete, onDelete, onOpen, onSetReadState }: Props) {
  const foldersQuery = useFolders()
  const navigate = useNavigate()
  // Asked once per card, so the link, the marker and the menu cannot disagree
  // about where this item goes.
  const readerDisabled = useReaderViewDisabled()
  const readsHere = !readerDisabled && hasReaderView(item)
  const leaves = !readerDisabled && !hasReaderView(item)
  const moveMutation = useMoveSavedItemToFolder()
  const rowRef = useRef<HTMLDivElement>(null)
  const wasSelectedRef = useRef(false)

  if (isSelected && !wasSelectedRef.current) {
    rowRef.current?.scrollIntoView({ block: "nearest" })
  }
  wasSelectedRef.current = isSelected ?? false

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.originalUrl)
    } catch {
      /* clipboard not available */
    }
  }

  const moveItems: ContextMenuItem[] = item.folder
    ? [{ key: "move-root", label: "Library", onClick: () => moveMutation.mutate({ itemId: item.id, folderId: null }) }]
    : []
  for (const folder of foldersQuery.data?.folders ?? []) {
    if (folder.id !== item.folder?.id) {
      moveItems.push({
        key: `move-${folder.id}`,
        label: folder.name,
        onClick: () => moveMutation.mutate({ itemId: item.id, folderId: folder.id }),
      })
    }
  }
  const items: readonly ContextMenuItem[] = [
    // Two destinations, named in the same shape so the pair reads as a choice
    // between two places. A single "Open" left it to the reader to guess which
    // of the two it meant, which is the whole point of the marker on the row.
    // The Reader entry is only offered when there is one to open.
    ...(readsHere
      ? [{
          key: "read",
          label: "Open in Reader",
          onClick: () => {
            if (!item.isRead) onOpen(item.id)
            void navigate({
              to: "/read/$savedItemId",
              params: { savedItemId: item.id },
              search: folder ? { folder } : {},
            })
          },
        }]
      : []),
    { key: "open", label: "Open in Browser", href: item.originalUrl },
    { key: "read", label: item.isRead ? "Mark Unread" : "Mark Read", onClick: () => onSetReadState(item.id, !item.isRead) },
    { key: "copy", label: "Copy URL", onClick: copyUrl },
    ...(moveItems.length > 0 ? [{ key: "move", label: "Move to", items: moveItems }] : []),
    { key: "delete", label: "Delete", destructive: true, onClick: () => onDelete(item.id) },
  ]

  const date = formatDate(item.lastSavedAt)

  if (pendingDelete) {
    return (
      <div ref={rowRef} className={clsx(styles.row, styles.selected, styles.deleteConfirm)}>
        <span className={styles.deletePrompt}>
          Delete this item? <kbd className={styles.kbd}>y</kbd> yes <kbd className={styles.kbd}>n</kbd> no
        </span>
      </div>
    )
  }

  return (
    <div
      ref={rowRef}
      className={clsx(styles.row, isSelected && styles.selected)}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData(SAVED_ITEM_DRAG_TYPE, item.id)
      }}
    >
      <CardLink
        className={styles.link}
        item={item}
        folder={folder}
        readsHere={readsHere}
        title={item.previewSummary}
        onOpen={() => { if (!item.isRead) onOpen(item.id) }}
      >
        <img
          className={styles.favicon}
          src={faviconUrl(item.host)}
          alt=""
          width={28}
          height={28}
          loading="lazy"
        />

        <div className={styles.body}>
          <span className={styles.title}>{item.title ?? item.host}</span>
          <span className={styles.host}>
            <span className={styles.hostName}>{item.host}</span>
            {/* This one leaves: no article was extracted, so opening it goes to
                the site in a new tab. Shown only while the two destinations are
                mixed — with the Reader View off they all leave, and the setting
                says so once instead of every row saying it. */}
            {leaves ? (
              <ExternalLink
                className={styles.external}
                size={12}
                strokeWidth={1.75}
                aria-label="Opens at its original URL"
              />
            ) : null}
          </span>
        </div>

        <span className={clsx(styles.date, !item.isRead && styles.unreadDate)}>{date}</span>
      </CardLink>

      <div className={styles["menu-wrapper"]}>
        <ContextMenu
          items={items}
          triggerClassName={styles["menu-trigger"]}
          triggerLabel={<MoreVertical size={16} />}
        />
      </div>
    </div>
  )
}
