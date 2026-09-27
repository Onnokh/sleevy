import { useCallback, useMemo, useSyncExternalStore } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { OnboardingDto, OnboardingPayload } from "@sleevy/contract"

import { authClient } from "../auth"
import { apiFetch } from "./api"
import { useFirstRunPreview } from "./first-run-preview"
import type { SavedItem } from "./saved-items"

/**
 * The Getting Started Card and the iPhone Card, for one Account.
 *
 * Most of what the Getting Started Card checks off is read from the Saved
 * Items themselves: a save, a read, a save from the iPhone. What no Saved Item
 * can tell — that the card was put away, that the Command Palette was opened,
 * that the iPhone step was seen, that the iPhone Card was hidden — is kept on
 * the Account, so it holds on every computer the person signs in on.
 */
type Onboarding = OnboardingDto.Encoded
type OnboardingChange = OnboardingPayload.Encoded

const NOTHING_YET: Onboarding = {
  gettingStartedDismissed: false,
  commandPaletteOpened: false,
  iphoneHandOffSeen: false,
  iphoneCardDismissed: false,
}

export const onboardingQueryKey = ["onboarding"] as const

/// The card is for people who are new to Sleevy. An Account older than this
/// has found its way around already, and would only see a checklist appear.
const NEW_ACCOUNT_DAYS = 14

export type GettingStartedStepKey = "save" | "open" | "palette" | "iphone"

export type GettingStartedStep = {
  readonly key: GettingStartedStepKey
  readonly done: boolean
}

const isFromIphone = (item: SavedItem) =>
  item.captureChannel === "ios-app" || item.captureChannel === "ios-share-extension"

/// Whether any of these Saved Items was saved on the iPhone. A list is the
/// newest page, so an Account whose iPhone saves are all older reads as none.
export const hasIphoneSaves = (items: readonly SavedItem[]) => items.some(isFromIphone)

/**
 * The four steps of the Getting Started Card, in the order they are shown.
 * Every step but the Command Palette one is true of the Saved Items, so it
 * checks itself off wherever the person did it — including on the iPhone.
 *
 * The iPhone step is the one that cannot be done at this computer, so it can
 * also be closed by hand: by checking it off, or by closing the hand-off.
 */
export function gettingStartedSteps(
  items: readonly SavedItem[],
  { paletteOpened, iphoneHandOffSeen }: { readonly paletteOpened: boolean; readonly iphoneHandOffSeen: boolean },
): readonly GettingStartedStep[] {
  return [
    { key: "save", done: items.length > 0 },
    { key: "open", done: items.some((item) => item.isRead) },
    { key: "palette", done: paletteOpened },
    { key: "iphone", done: iphoneHandOffSeen || hasIphoneSaves(items) },
  ]
}

const isNewAccount = (createdAt: Date | string | undefined): boolean => {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000
}

const withoutUnset = (change: OnboardingChange): Partial<Onboarding> =>
  Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined))

/// The Account's own state, read from the API and changed there. A change
/// shows at once and is undone if the API refuses it.
function useAccountOnboarding(enabled: boolean) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: onboardingQueryKey,
    enabled,
    queryFn: () => apiFetch<Onboarding>("/v1/onboarding"),
    staleTime: 5 * 60_000,
  })
  const mutation = useMutation({
    mutationFn: (change: OnboardingChange) =>
      apiFetch<Onboarding>("/v1/onboarding", { method: "PATCH", body: JSON.stringify(change) }),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: onboardingQueryKey })
      const previous = queryClient.getQueryData<Onboarding>(onboardingQueryKey)
      queryClient.setQueryData<Onboarding>(onboardingQueryKey, { ...(previous ?? NOTHING_YET), ...withoutUnset(change) })
      return { previous }
    },
    onError: (_cause, _change, context) => {
      queryClient.setQueryData(onboardingQueryKey, context?.previous)
    },
    onSuccess: (onboarding) => {
      queryClient.setQueryData(onboardingQueryKey, onboarding)
    },
  })

  return {
    state: query.data ?? NOTHING_YET,
    // An API that cannot answer leaves the cards at their defaults rather than
    // hiding them for good.
    isLoaded: query.isSuccess || query.isError,
    change: mutation.mutate,
  }
}

// A first-run preview keeps a state of its own in this browser, so trying the
// steps never checks off or hides anything on the Account.
const previewKey = (accountId: string) => `sleeve:gettingStarted:${accountId}:preview`

const previewListeners = new Set<() => void>()

const subscribePreview = (onChange: () => void) => {
  previewListeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    previewListeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

const readPreview = (accountId: string | undefined): string | null =>
  accountId && typeof localStorage !== "undefined" ? localStorage.getItem(previewKey(accountId)) : null

const parsePreview = (raw: string | null): Onboarding => {
  if (!raw) return NOTHING_YET
  try {
    return { ...NOTHING_YET, ...(JSON.parse(raw) as Partial<Onboarding>) }
  } catch {
    return NOTHING_YET
  }
}

function usePreviewOnboarding(accountId: string | undefined) {
  const raw = useSyncExternalStore(subscribePreview, () => readPreview(accountId), () => null)
  const state = useMemo(() => parsePreview(raw), [raw])

  const change = useCallback((next: OnboardingChange) => {
    if (!accountId) return
    const merged = { ...parsePreview(readPreview(accountId)), ...withoutUnset(next) }
    localStorage.setItem(previewKey(accountId), JSON.stringify(merged))
    for (const listener of previewListeners) listener()
  }, [accountId])

  return { state, isLoaded: true, change }
}

export function useGettingStarted() {
  const { data: session } = authClient.useSession()
  const preview = useFirstRunPreview()
  const accountId = session?.user.id

  const account = useAccountOnboarding(!preview && Boolean(accountId))
  const previewed = usePreviewOnboarding(preview ? accountId : undefined)
  const { state, isLoaded, change } = preview ? previewed : account

  const dismiss = useCallback(() => change({ gettingStartedDismissed: true }), [change])

  // Brought back from the Command Palette, so a card put away too early is
  // never lost for good.
  const reopen = useCallback(() => change({ gettingStartedDismissed: false }), [change])

  // Asked on every open of the palette, and sent only the first time.
  const markPaletteOpened = useCallback(() => {
    if (isLoaded && !state.commandPaletteOpened) change({ commandPaletteOpened: true })
  }, [change, isLoaded, state.commandPaletteOpened])

  const markIphoneHandOffSeen = useCallback(() => {
    if (!state.iphoneHandOffSeen) change({ iphoneHandOffSeen: true })
  }, [change, state.iphoneHandOffSeen])

  const dismissIphoneCard = useCallback(() => change({ iphoneCardDismissed: true }), [change])

  return {
    isNewAccount: preview !== null || isNewAccount(session?.user.createdAt),
    /** Whether the Account's state has arrived, so a hidden card never flashes up first. */
    isLoaded,
    dismissed: state.gettingStartedDismissed,
    paletteOpened: state.commandPaletteOpened,
    iphoneHandOffSeen: state.iphoneHandOffSeen,
    iphoneCardDismissed: state.iphoneCardDismissed,
    dismiss,
    reopen,
    markPaletteOpened,
    markIphoneHandOffSeen,
    dismissIphoneCard,
  }
}
