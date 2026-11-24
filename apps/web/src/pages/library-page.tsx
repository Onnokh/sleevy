import { useCallback, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowUpDown, ChevronRight, Folder as FolderIcon, Library, X } from "lucide-react"

import { type SavedItem, type SavedItemSort, useDeleteItem, useMarkAsRead, useSavedItems, useSetReadState } from "../sleevy/saved-items"
import { SavedCard } from "../components/saved-card/saved-card"
import { SavedItemList } from "../components/saved-card/saved-item-list"
import { SavedListSkeleton } from "../components/saved-card/saved-card-skeleton"
import { FolderEditDialog } from "../components/folders/folder-dialog"
import { useSourceFilter } from "../components/source-filter/source-filter"
import {
  byCountDescending,
  getSourceGroup,
  sourceCountsOf,
  tagCountsOf,
} from "../components/source-filter/source-filter-utils"
import { useKeyboardNav } from "../contexts/keyboard-nav-context"
import { useMediaQuery } from "../hooks/use-media-query"
import { useTitleBearing } from "../hooks/use-title-bearing"
import { useOpenSavedItem } from "../hooks/use-open-saved-item"
import { useSelectedItemActions } from "../hooks/use-selected-item-actions"
import { folderErrorMessage, type Folder, useFolders, useRenameFolder, useSetFolderPublished } from "../sleevy/folders"
import { useIsProfilePublic } from "../sleevy/profile"
import { ContextMenu, type ContextMenuItem } from "../components/ui/context-menu/context-menu"
import { PageActions, pageActionButtonClassName } from "../components/ui/page-actions/page-actions"
import { PageTitleBar } from "../components/ui/page-title-bar/page-title-bar"

const SORTS: readonly { readonly value: SavedItemSort; readonly label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "title", label: "Title" },
  { value: "unread", label: "Unread First" },
]

/// Below this the sidebar is a sheet, so the Library home lists its Folders
/// itself, as the iOS app does on a phone.
const COMPACT = "(max-width: 768px)"

export function LibraryPage({ folderId }: { readonly folderId?: string }) {
  const [sort, setSort] = useState<SavedItemSort>("newest")
  // TanStack Query should fetch again when users select a different sort or folder.
  // eslint-disable-next-line react-doctor/no-event-handler
  const savedItemsQuery = useSavedItems(sort, folderId ?? "none")
  const allSavedItemsQuery = useSavedItems()
  const foldersQuery = useFolders()
  const renameMutation = useRenameFolder()
  const publishMutation = useSetFolderPublished()
  const deleteMutation = useDeleteItem()
  const markAsReadMutation = useMarkAsRead()
  // Opening from the Library carries the Folder it is showing, so the Reader
  // View's list is this Folder and not the whole library.
  const openSavedItem = useOpenSavedItem(folderId ?? "none")
  const setReadStateMutation = useSetReadState()
  const { activeSource, setActiveSource, activeType, setActiveType, activeTag, setActiveTag } = useSourceFilter()
  const { selectedIndex, setSelectedIndex, setListLength, setItemActions, pendingDelete } = useKeyboardNav()
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [titleEl, setTitleEl] = useState<HTMLHeadingElement | null>(null)
  const isProfilePublic = useIsProfilePublic()
  const compact = useMediaQuery(COMPACT)

  const allItems = savedItemsQuery.data?.savedItems ?? []
  const folders = foldersQuery.data?.folders ?? []
  const folder = folders.find((candidate) => candidate.id === folderId)
  const items = allItems.filter((item) =>
    (!activeSource || getSourceGroup(item) === activeSource)
    && (!activeType || item.type === activeType)
    && (!activeTag || item.tags.includes(activeTag as (typeof item.tags)[number]))
  )
  const unreadCount = items.filter((item) => !item.isRead).length
  const wholeLibrary = allSavedItemsQuery.data?.savedItems ?? []
  // Beside the sidebar, the sidebar lists the Folders. Without it, the
  // Library home holds them in one strip, so its saves still start near the
  // top.
  const showsFolderStrip = !folderId && compact && folders.length > 0

  const activeFilters = [
    activeSource ? { key: "source", label: "Source", value: activeSource, clear: () => setActiveSource(null) } : null,
    activeTag ? { key: "tag", label: "Tag", value: activeTag, clear: () => setActiveTag(null) } : null,
    activeType ? { key: "type", label: "Type", value: activeType, clear: () => setActiveType(null) } : null,
  ].filter((filter) => filter !== null)

  const getItemActions = useCallback((item: SavedItem) => ({
    onOpen: () => openSavedItem(item),
    onToggleRead: () => setReadStateMutation.mutate({ id: item.id, isRead: !item.isRead }),
    onCopyUrl: () => void navigator.clipboard.writeText(item.originalUrl).catch(() => {}),
    onDelete: () => deleteMutation.mutate(item.id),
  }), [deleteMutation, openSavedItem, setReadStateMutation])

  useSelectedItemActions({ items, selectedIndex, setListLength, setItemActions, getItemActions })

  useEffect(() => {
    if (selectedIndex >= items.length) setSelectedIndex(Math.max(items.length - 1, -1))
  }, [items.length, selectedIndex, setSelectedIndex])

  const pageTitle = folderId ? (folder?.name ?? "Folder") : "Library"
  useTitleBearing(folderId ? titleEl : null, pageTitle)
  const savesText = (count: number) => `${count} ${count === 1 ? "save" : "saves"}`
  // As the iOS app says it. The Library home counts the whole Library,
  // Folders included, as its sidebar row does. A Folder counts its own saves,
  // the unread part goes once all is read, and a Folder on the Public Profile
  // says so.
  const subtitle = folderId
    ? [
        savesText(items.length),
        unreadCount > 0 ? `${unreadCount} unread` : null,
        folder && isProfilePublic && folder.isPublished ? "Public" : null,
      ].filter(Boolean).join(" · ")
    : savesText(wholeLibrary.length)

  // Sort, Source and Tags in one menu, as the iOS sort menu holds them, and
  // a Folder's own actions under them.
  const choices = (
    key: string,
    names: readonly string[],
    active: string | null,
    choose: (value: string | null) => void,
  ): ContextMenuItem[] => [
    { key: `${key}-all`, label: "All", checked: active === null, onClick: () => choose(null) },
    ...names.map((name) => ({ key: `${key}-${name}`, label: name, checked: active === name, onClick: () => choose(name) })),
  ]
  const menu: ContextMenuItem[] = [
    {
      key: "sort",
      label: "Sort",
      items: SORTS.map((option) => ({ key: option.value, label: option.label, checked: sort === option.value, onClick: () => setSort(option.value) })),
    },
    { key: "source", label: "Source", items: choices("source", byCountDescending(sourceCountsOf(wholeLibrary)).map(([name]) => name), activeSource, setActiveSource) },
    { key: "tag", label: "Tags", items: choices("tag", byCountDescending(tagCountsOf(wholeLibrary)).map(([tag]) => tag), activeTag, setActiveTag) },
    ...(folder
      ? [
          { key: "edit", label: "Edit Folder", separated: true, onClick: () => setEditingFolder(folder) },
          {
            key: "publish",
            label: folder.isPublished ? "Remove from Profile" : "Publish to Profile",
            onClick: () => publishMutation.mutate({ id: folder.id, isPublished: !folder.isPublished }),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageTitleBar title={pageTitle} watch={titleEl} />

      <div className="page-column">
        <div className="page-header">
          <div className="page-heading">
            {/* A Folder is a level down in the Library: the Library, the way back,
                comes first on its title line. */}
            {folderId ? (
              <div className="page-title-row">
                <Link to="/library" className="page-title-home" aria-label="Library" title="Library">
                  <Library size={24} strokeWidth={2.25} aria-hidden="true" />
                </Link>
                <ChevronRight className="page-title-separator" size={16} strokeWidth={2.25} absoluteStrokeWidth aria-hidden="true" />
                <h1 className="page-title" ref={setTitleEl}>{pageTitle}</h1>
              </div>
            ) : (
              <h1 className="page-title" ref={setTitleEl}>{pageTitle}</h1>
            )}
            {savedItemsQuery.data ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>
          <PageActions>
            <ContextMenu
              items={menu}
              triggerClassName={pageActionButtonClassName}
              triggerAriaLabel="Sort and filter"
              triggerLabel={<ArrowUpDown size={18} strokeWidth={1.75} aria-hidden="true" />}
            />
          </PageActions>
        </div>

        {showsFolderStrip ? (
          <nav className="chip-strip" aria-label="Folders">
            {folders.map((candidate) => (
              <Link key={candidate.id} className="chip" to="/library/folders/$folderId" params={{ folderId: candidate.id }}>
                <FolderIcon size={14} aria-hidden="true" />
                <span>{candidate.name}</span>
                <span className="chip-count">{wholeLibrary.filter((item) => item.folder?.id === candidate.id).length}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        {activeFilters.length > 0 ? (
          <div className="chip-strip">
            {activeFilters.map((filter) => (
              <button key={filter.key} type="button" className="chip" aria-label={`Clear ${filter.label}: ${filter.value}`} onClick={filter.clear}>
                <span className="chip-label">{filter.label}</span>
                <span>{filter.value}</span>
                <X size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        {savedItemsQuery.isLoading ? <SavedListSkeleton /> : null}
        {savedItemsQuery.isError ? <p>Could not load saved items.</p> : null}

        {!savedItemsQuery.isLoading && !savedItemsQuery.isError ? (
          items.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon" aria-hidden="true">
                <Library size={28} strokeWidth={1.75} />
              </span>
              <p>
                {activeFilters.length > 0
                  ? "No saves match these filters."
                  : folderId ? "This folder is empty." : "No saves outside your folders."}
              </p>
            </div>
          ) : (
            <SavedItemList
              items={items}
              groupsByDate={sort === "newest" || sort === "oldest"}
              renderItem={(item, index) => (
                <SavedCard item={item} folder={folderId ?? "none"} isSelected={index === selectedIndex} pendingDelete={index === selectedIndex && pendingDelete} onDelete={(id) => deleteMutation.mutate(id)} onOpen={(id) => markAsReadMutation.mutate(id)} onSetReadState={(id, isRead) => setReadStateMutation.mutate({ id, isRead })} />
              )}
            />
          )
        ) : null}
      </div>

      {editingFolder ? (
        <FolderEditDialog
          folder={editingFolder}
          isPending={renameMutation.isPending}
          error={renameMutation.error ? folderErrorMessage(renameMutation.error) : null}
          onClose={() => {
            renameMutation.reset()
            setEditingFolder(null)
          }}
          onSubmit={(name, color) => renameMutation.mutate({ id: editingFolder.id, name, color }, { onSuccess: () => setEditingFolder(null) })}
        />
      ) : null}
    </>
  )
}
