import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AccountSettingsDto, AccountSettingsPayload } from "@sleevy/contract"

import { apiFetch } from "./api"

/**
 * The Account settings that follow the person to every device, such as
 * Auto-Filing. Kept on the Account, unlike the Reader View choice, which
 * belongs to one browser.
 */
type AccountSettings = AccountSettingsDto.Encoded
type AccountSettingsChange = AccountSettingsPayload.Encoded

export const accountSettingsQueryKey = ["account-settings"] as const

export function useAccountSettings(enabled = true) {
  return useQuery({
    queryKey: accountSettingsQueryKey,
    enabled,
    queryFn: () => apiFetch<AccountSettings>("/v1/settings"),
    staleTime: 5 * 60_000,
  })
}

/// A change shows at once and is undone if the API refuses it.
export function useUpdateAccountSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (change: AccountSettingsChange) =>
      apiFetch<AccountSettings>("/v1/settings", { method: "PATCH", body: JSON.stringify(change) }),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: accountSettingsQueryKey })
      const previous = queryClient.getQueryData<AccountSettings>(accountSettingsQueryKey)
      if (previous) {
        queryClient.setQueryData<AccountSettings>(accountSettingsQueryKey, {
          ...previous,
          ...(change.autoFiling !== undefined ? { autoFiling: change.autoFiling } : {}),
        })
      }
      return { previous }
    },
    onError: (_cause, _change, context) => {
      queryClient.setQueryData(accountSettingsQueryKey, context?.previous)
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(accountSettingsQueryKey, settings)
    },
  })
}
