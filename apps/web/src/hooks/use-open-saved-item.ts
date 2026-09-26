import { useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"

import { type FolderSelector, type SavedItem, useMarkAsRead } from "../sleevy/saved-items"
import { useOpensInReader } from "../sleevy/reader-destination"

/**
 * The Open Action, in one place because it is one rule: opening a Saved Item
 * that opens in the Reader View opens it there, and any other sends the person
 * to its Original URL in the browser. Either way the item is read, because
 * opening it is what reading it means.
 *
 * Whether the Reader View is a destination at all is the reader's own setting,
 * which is why the question is asked rather than answered from the item alone.
 *
 * The caller says which Folder it is showing, and the Reader View carries that
 * scope so the list beside the article is the list the reader just left. It
 * travels in the URL rather than in memory, so the same link opens the same
 * three panes when it is shared or restored.
 */
export function useOpenSavedItem(folder?: FolderSelector) {
  const navigate = useNavigate()
  const markAsReadMutation = useMarkAsRead()
  const opensInReader = useOpensInReader()

  return useCallback(
    (item: SavedItem) => {
      if (!item.isRead) markAsReadMutation.mutate(item.id)

      if (opensInReader(item)) {
        void navigate({
          to: "/read/$savedItemId",
          params: { savedItemId: item.id },
          search: folder ? { folder } : {},
        })
        return
      }

      window.open(item.originalUrl, "_blank", "noreferrer")
    },
    [folder, markAsReadMutation, navigate, opensInReader],
  )
}
