import { createFileRoute } from "@tanstack/react-router"

import { SavedItemReaderPage } from "../../pages/saved-item-reader-page"

/**
 * Which Folder the list beside the article is showing: a Folder id, `none` for
 * the Saved Items in no Folder, or absent for every Saved Item. Anything else
 * is dropped rather than rejected — a bad scope in a shared link should open
 * the article, not an error page.
 */
type ReaderSearch = { readonly folder?: string }

export const Route = createFileRoute("/_app/read/$savedItemId")({
  head: () => ({
    meta: [{ title: "Reader - Sleevy" }],
  }),
  validateSearch: (search: Record<string, unknown>): ReaderSearch =>
    typeof search.folder === "string" && search.folder.length > 0
      ? { folder: search.folder }
      : {},
  component: SavedItemReaderPage,
})
