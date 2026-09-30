import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useState } from "react"

import type {
  CaptureResponseEncoded,
  SavedItemDto,
  SavedItemSort,
  SavedItemsResponse,
  Topic,
} from "@sleevy/contract"

import { getSourceName } from "../components/source-name/source-name-storage"
import { useAccountSettings } from "./account-settings"
import { apiFetch } from "./api"

export type { SavedItemSort, Topic }
export type SavedItem = SavedItemDto.Encoded
type SavedItemsResponseJson = SavedItemsResponse.Encoded
type CaptureResponseJson = CaptureResponseEncoded

function detectSourceName(): string {
  const custom = getSourceName()
  if (custom) return custom
  const ua = navigator.userAgent
  if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "macOS"
  if (ua.includes("Windows")) return "Windows"
  if (ua.includes("Linux")) return "Linux"
  return "Desktop"
}

export const savedItemsQueryKey = ["saved-items"] as const
/**
 * Which Folder a list is showing: one Folder by id, `"none"` for the Saved
 * Items that are in no Folder, or nothing at all for every Saved Item.
 */
export type FolderSelector = string | "none" | undefined

const savedItemsListQueryKey = (sort: SavedItemSort, folder: FolderSelector) =>
  [...savedItemsQueryKey, sort, folder ?? "all"] as const

const updateSavedItemsCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (response: SavedItemsResponseJson) => SavedItemsResponseJson,
) => {
  const queries = queryClient.getQueryCache().findAll({ queryKey: savedItemsQueryKey })
  for (const query of queries) {
    queryClient.setQueryData<SavedItemsResponseJson>(query.queryKey, (previous) =>
      previous ? updater(previous) : previous,
    )
  }
}

// While a save from the last minute is still being enriched, the list asks
// again every so often, so its row gains its title and summary in place
// (Hydration) without a reload. Only recent saves count: a Link can stay
// pending for a long time, and a list must not poll forever because of one.
const HYDRATION_POLL_MS = 1500
const HYDRATION_WINDOW_MS = 60_000

// Auto-Filing runs just after Enrichment, so a save can gain its Folder a
// moment after it stops being pending. While it is on, a new save that is still
// unfiled keeps the list asking for a few seconds more.
const AUTO_FILING_WINDOW_MS = 10_000

const isHydrating = (response: SavedItemsResponseJson | undefined, autoFiling: boolean): boolean => {
  const now = Date.now()
  return (response?.savedItems ?? []).some((item) => {
    const age = now - Date.parse(item.lastSavedAt)
    return (item.enrichmentStatus === "pending" && age < HYDRATION_WINDOW_MS) ||
      (autoFiling && item.folder === null && age < AUTO_FILING_WINDOW_MS)
  })
}

export function useSavedItems(
  sort: SavedItemSort = "newest",
  folder?: FolderSelector,
  enabled = true,
) {
  const params = new URLSearchParams({ sort })
  if (folder) params.set("folder", folder)
  const autoFiling = useAccountSettings(enabled).data?.autoFiling ?? false

  return useQuery({
    queryKey: savedItemsListQueryKey(sort, folder),
    enabled,
    queryFn: () => apiFetch<SavedItemsResponseJson>(`/v1/saved-items?${params.toString()}`),
    staleTime: 30_000,
    refetchInterval: (query) => isHydrating(query.state.data, autoFiling) ? HYDRATION_POLL_MS : false,
  })
}

export function useCapture(initialUrl = "") {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState(initialUrl)
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (inputUrl: string) =>
      apiFetch<CaptureResponseJson>("/v1/captures", {
        method: "POST",
        body: JSON.stringify({
          url: inputUrl,
          captureChannel: "web-companion" as const,
          sourceName: detectSourceName(),
        }),
      }),
    onSuccess: () => {
      setUrl("")
      setFormError(null)
      void queryClient.invalidateQueries({ queryKey: savedItemsQueryKey })
    },
    onError: (cause) => {
      setFormError(cause instanceof Error ? cause.message : "Capture failed.")
    },
  })

  const captureUrl = (inputUrl: string, onCaptured?: (response: CaptureResponseJson) => void) => {
    const trimmed = inputUrl.trim()
    if (!trimmed) {
      setFormError("Paste a URL first.")
      return
    }
    setFormError(null)
    mutation.mutate(trimmed, { onSuccess: onCaptured })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    captureUrl(url)
  }

  const reset = () => {
    setUrl("")
    setFormError(null)
  }

  return { url, setUrl, formError, isPending: mutation.isPending, submit, captureUrl, reset }
}

// A save taken from someone else's Public Profile. The reads on that page carry
// no credentials so the API may cache them for everyone, but this is a signed-in
// action for one visitor, so it goes through `apiFetch` and sends the session.
export const capturePublicProfileLink = (url: string) =>
  apiFetch<CaptureResponseJson>("/v1/captures", {
    method: "POST",
    body: JSON.stringify({ url, captureChannel: "public-profile" as const }),
  })

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/saved-items/${id}/open`, { method: "POST" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: savedItemsQueryKey })
      const previous = queryClient.getQueriesData<SavedItemsResponseJson>({ queryKey: savedItemsQueryKey })
      updateSavedItemsCaches(queryClient, (response) => ({
        savedItems: response.savedItems.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
      }))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedItemsQueryKey }),
  })
}

type SetReadStateInput = { readonly id: string; readonly isRead: boolean }

export function useSetReadState() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isRead }: SetReadStateInput) =>
      apiFetch<void>(`/v1/saved-items/${id}/read-state`, {
        method: "POST",
        body: JSON.stringify({ isRead }),
      }),
    onMutate: async ({ id, isRead }) => {
      await queryClient.cancelQueries({ queryKey: savedItemsQueryKey })
      const previous = queryClient.getQueriesData<SavedItemsResponseJson>({ queryKey: savedItemsQueryKey })
      updateSavedItemsCaches(queryClient, (response) => ({
        savedItems: response.savedItems.map((item) =>
          item.id === id ? { ...item, isRead } : item,
        ),
      }))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedItemsQueryKey }),
  })
}

export function useMoveItemsToSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemIds, sourceName }: { readonly itemIds: readonly string[]; readonly sourceName: string }) =>
      apiFetch<void>("/v1/saved-items/source", {
        method: "PUT",
        body: JSON.stringify({ itemIds, sourceName }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: savedItemsQueryKey }),
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/saved-items/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: savedItemsQueryKey })
      const previous = queryClient.getQueriesData<SavedItemsResponseJson>({ queryKey: savedItemsQueryKey })
      updateSavedItemsCaches(queryClient, (response) => ({
        savedItems: response.savedItems.filter((item) => item.id !== id),
      }))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedItemsQueryKey }),
  })
}
