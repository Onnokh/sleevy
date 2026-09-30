import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { OrganizeApplyPayload, OrganizeResultDto, OrganizeRunDto } from "@sleevy/contract"

import { apiFetch } from "./api"
import { foldersQueryKey } from "./folders"
import { savedItemsQueryKey } from "./saved-items"

/**
 * Organize: the Account's one background run that sorts every unfiled save
 * into Folders, and the plan it leaves for the person to apply or discard.
 */
export type OrganizeRun = OrganizeRunDto.Encoded
export type OrganizePlan = NonNullable<OrganizeRun["plan"]>
type OrganizeApply = OrganizeApplyPayload.Encoded
type OrganizeResult = OrganizeResultDto.Encoded

const organizeRunQueryKey = ["organize-run"] as const

/// Polls while the run works through its batches, and stops once it settles.
export function useOrganizeRun() {
  return useQuery({
    queryKey: organizeRunQueryKey,
    queryFn: () => apiFetch<OrganizeRun>("/v1/settings/organize"),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1500 : false),
  })
}

export function useStartOrganize() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<OrganizeRun>("/v1/settings/organize", { method: "POST" }),
    onSuccess: (run) => queryClient.setQueryData(organizeRunQueryKey, run),
  })
}

export function useDiscardOrganize() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<OrganizeRun>("/v1/settings/organize", { method: "DELETE" }),
    onSuccess: (run) => queryClient.setQueryData(organizeRunQueryKey, run),
  })
}

export function useApplyOrganize() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (kept: OrganizeApply) =>
      apiFetch<OrganizeResult>("/v1/settings/organize/apply", { method: "POST", body: JSON.stringify(kept) }),
    onSuccess: () => {
      queryClient.setQueryData<OrganizeRun>(organizeRunQueryKey, {
        status: "idle",
        phase: null,
        done: 0,
        total: 0,
        plan: null,
      })
      void queryClient.invalidateQueries({ queryKey: foldersQueryKey })
      void queryClient.invalidateQueries({ queryKey: savedItemsQueryKey })
    },
  })
}
