import { useQuery } from "@tanstack/react-query"

import type { ReadableContentDto } from "@sleevy/contract"

import { apiFetch } from "./api"

export type ReadableContent = ReadableContentDto.Encoded

export const readableContentQueryKey = (savedItemId: string) =>
  ["readable-content", savedItemId] as const

/**
 * A Saved Item's Readable Content, for the Reader View.
 *
 * Its own request, never part of a list read, so opening one item never
 * changes what a list costs. A Saved Item whose Link yielded no article
 * answers 404 — check `hasReadableContent` before routing here, because that
 * 404 is the ordinary case rather than a fault.
 */
export function useReadableContent(savedItemId: string, enabled = true) {
  return useQuery({
    queryKey: readableContentQueryKey(savedItemId),
    enabled: enabled && savedItemId.length > 0,
    queryFn: () =>
      apiFetch<ReadableContent>(`/v1/saved-items/${savedItemId}/content`),
    // Readable Content is extracted once and never rewritten, so a fetched
    // article does not go stale while the tab is open.
    staleTime: Infinity,
    retry: false,
  })
}
