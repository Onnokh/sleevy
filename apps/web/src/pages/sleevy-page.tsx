import { useCallback, useEffect, useState } from "react"
import { CircleCheck } from "lucide-react"
import { domMax, LazyMotion, MotionConfig } from "motion/react"

import { type SavedItem, useDeleteItem, useMarkAsRead, useSavedItems, useSetReadState } from "../sleevy/saved-items"
import { gettingStartedSteps, useGettingStarted } from "../sleevy/onboarding"
import { previewSavedItems, useFirstRunPreview } from "../sleevy/first-run-preview"
import { FirstRunPreviewBar } from "../components/onboarding/first-run-preview-bar"
import { AuroraBackground } from "../components/aurora/aurora-background"
import { EnrichmentReveal } from "../components/onboarding/enrichment-reveal"
import { FirstRunInbox } from "../components/onboarding/first-run-inbox"
import { GettingStartedCard } from "../components/onboarding/getting-started-card"
import { PageTitleBar } from "../components/ui/page-title-bar/page-title-bar"
import { SavedCard } from "../components/saved-card/saved-card"
import { SavedListSkeleton } from "../components/saved-card/saved-card-skeleton"
import { useKeyboardNav } from "../contexts/keyboard-nav-context"
import { useOpenSavedItem } from "../hooks/use-open-saved-item"
import { useSelectedItemActions } from "../hooks/use-selected-item-actions"

export function SleevyPage() {
  const savedItemsQuery = useSavedItems()
  const deleteMutation = useDeleteItem()
  const markAsReadMutation = useMarkAsRead()
  const openSavedItem = useOpenSavedItem()
  const setReadStateMutation = useSetReadState()
  const gettingStarted = useGettingStarted()
  const { selectedIndex, setSelectedIndex, setListLength, setItemActions, pendingDelete, openCaptureDialog, openPalette } = useKeyboardNav()
  const [titleEl, setTitleEl] = useState<HTMLHeadingElement | null>(null)
  // The Saved Item made from the First-Run Inbox, shown large while Sleevy
  // enriches it. The capture response stands in until the list has it.
  const [revealed, setRevealed] = useState<SavedItem | null>(null)
  const [justSettled, setJustSettled] = useState(false)

  const preview = useFirstRunPreview()
  const loadedItems = savedItemsQuery.data?.savedItems ?? []
  const allItems = preview ? previewSavedItems(loadedItems, preview) : loadedItems
  const revealItem = revealed ? allItems.find((item) => item.id === revealed.id) ?? revealed : null
  const items = allItems.filter((item) => !item.isRead && item.id !== revealItem?.id)
  const isLoaded = !savedItemsQuery.isLoading && !savedItemsQuery.isError
  const isFirstRun = isLoaded && allItems.length === 0 && !revealItem

  const steps = gettingStartedSteps(allItems, gettingStarted)
  const showsGettingStarted = gettingStarted.isNewAccount
    && gettingStarted.isLoaded
    && !gettingStarted.dismissed
    && allItems.length > 0
    && !revealItem
    && steps.some((step) => !step.done)

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

  const subtitle = isFirstRun
    ? "Nothing saved yet"
    : revealItem
      ? `${items.length + 1} unread`
      : `${items.length} unread`

  return (
    <>
      <PageTitleBar title="Inbox" watch={titleEl} />

      <div className="page-header page-header-card">
        <AuroraBackground className="page-header-card-shader" />
        <div className="page-heading">
          <h1 className="page-title" ref={setTitleEl}>Inbox</h1>
          {savedItemsQuery.data ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
      </div>

      {savedItemsQuery.isLoading ? <SavedListSkeleton /> : null}
      {savedItemsQuery.isError ? <p>Could not load saved items.</p> : null}

      {/* The layout features the first save needs: the capture field grows
          into the Enrichment Reveal, the reveal folds into its row, and the
          Getting Started Card opens above it. */}
      <LazyMotion features={domMax}>
        <MotionConfig reducedMotion="user">
          {isFirstRun ? <FirstRunInbox onCaptured={setRevealed} /> : null}
          {revealItem ? (
            <EnrichmentReveal
              item={revealItem}
              onSettled={() => {
                setRevealed(null)
                setJustSettled(true)
              }}
            />
          ) : null}

          {showsGettingStarted ? (
            <GettingStartedCard
              steps={steps}
              opens={justSettled}
              onDismiss={gettingStarted.dismiss}
              onIphoneDone={gettingStarted.markIphoneHandOffSeen}
              onStep={(key) => {
                if (key === "save") openCaptureDialog()
                else if (key === "open") setSelectedIndex(0)
                else openPalette()
              }}
            />
          ) : null}
        </MotionConfig>
      </LazyMotion>

      {isLoaded && !isFirstRun && !revealItem ? (
        items.length === 0 ? (
          <div className={showsGettingStarted ? "empty-state empty-state-compact" : "empty-state"}>
            <span className="empty-state-icon" aria-hidden="true">
              <CircleCheck size={28} strokeWidth={1.75} />
            </span>
            <p>All caught up.</p>
            <p className="empty-state-hint">Unread saves will appear here.</p>
          </div>
        ) : (
          <ul className="item-list">
            {items.map((item, index) => (
              <li key={item.id}>
                <SavedCard item={item} isSelected={index === selectedIndex} pendingDelete={index === selectedIndex && pendingDelete} onDelete={(id) => deleteMutation.mutate(id)} onOpen={(id) => markAsReadMutation.mutate(id)} onSetReadState={(id, isRead) => setReadStateMutation.mutate({ id, isRead })} />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {preview ? <FirstRunPreviewBar preview={preview} /> : null}
    </>
  )
}
