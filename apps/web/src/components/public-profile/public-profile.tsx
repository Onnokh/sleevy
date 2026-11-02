import { type FormEvent, type Ref, useEffect, useRef, useState } from "react"
import { useLocation } from "@tanstack/react-router"
import clsx from "clsx"

import {
  displayProfileUrl,
  errorMessageOf,
  handleProblem,
  normalizeHandle,
  publicProfileUrl,
  useClaimHandle,
  useHandleAvailability,
  useProfile,
  useRenameHandle,
  useSetProfileVisibility,
} from "../../sleevy/profile"
import { AuroraBackground } from "../aurora/aurora-background"
import { Button } from "../ui/button/button"
import { InputField } from "../ui/input-field/input-field"
import styles from "./public-profile.module.scss"

const HANDLE_RULE = "3 to 30 characters: letters a-z, digits, hyphen, and underscore."

// Settings opens at Account, with this panel two cards further down. A reader
// who arrived by pressing Claim handle has to be carried to it, so the row
// links to this hash and the panel answers it.
export const PUBLIC_PROFILE_HASH = "public-profile"

// How long the aurora burns brighter than it rests. Long enough to be seen
// after the scroll settles, short enough that the card is back to its own
// quiet level before the reader has finished typing a handle.
const SPOTLIGHT_MS = 2000

// The claim flare: the aurora burns up and drains away while the card turns
// into the address it just gave you. Matches the keyframes in the stylesheet.
const CLAIM_FLARE_MS = 1800

// A claimed Handle has one step left, and Profile Visibility may only turn on
// through an explicit confirmed action (CONTEXT.md). So the claim opens that
// confirmation itself, in the same frame as the address: the consequences are
// on screen the moment the Handle is, and saying yes is one press. Cancelling
// leaves the card private, which is a choice, not a half-finished errand.

type HandleFormProps = {
  readonly mode: "claim" | "rename"
  readonly currentHandle: string | null
  readonly isPending: boolean
  readonly onSubmit: (handle: string) => void
  readonly onCancel?: () => void
  readonly fieldRef?: Ref<HTMLInputElement>
}

function HandleForm({ mode, currentHandle, isPending, onSubmit, onCancel, fieldRef }: HandleFormProps) {
  const [value, setValue] = useState(currentHandle ?? "")
  const [debounced, setDebounced] = useState("")

  const handle = normalizeHandle(value)
  const problem = handle === "" ? null : handleProblem(handle)
  const isOwnHandle = currentHandle !== null && handle === currentHandle

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(handle), 350)
    return () => clearTimeout(timer)
  }, [handle])

  const canCheck = handle !== "" && problem === null && !isOwnHandle && debounced === handle
  const availability = useHandleAvailability(debounced, canCheck)
  const isTaken = canCheck && availability.data?.available === false
  const isFree = canCheck && availability.data?.available === true

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (handle === "" || problem !== null || isTaken || isOwnHandle) return
    onSubmit(handle)
  }

  const status = problem
    ? problem
    : handle === ""
      ? HANDLE_RULE
      : isOwnHandle
        ? "This is your handle already."
        : isTaken
          ? "Someone already has this handle. Choose another one."
          : isFree
            ? "This handle is free."
            : availability.isError
              ? "Could not check this handle. You can still try to save it."
              : "Checking…"

  const hintTone = problem || isTaken ? styles["hint-problem"] : undefined

  return (
    <form className={styles["handle-form"]} onSubmit={submit}>
      <div className={styles["handle-row"]}>
        <InputField
          ref={fieldRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="your-handle"
          aria-label={mode === "claim" ? "Choose your handle" : "Change your handle"}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
        />
        <Button type="submit" disabled={isPending || handle === "" || problem !== null || isTaken || isOwnHandle}>
          {isPending ? "Saving…" : mode === "claim" ? "Claim handle" : "Save handle"}
        </Button>
        {onCancel ? (
          <Button variant="ghost" type="button" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        ) : null}
      </div>
      <p className={hintTone ? `${styles.hint} ${hintTone}` : styles.hint}>
        {handle === "" ? null : <span className={styles.preview}>{displayProfileUrl(handle)}</span>}
        {status}
      </p>
      {mode === "rename" ? (
        <p className={styles.hint}>
          Your old handle is released immediately, and anyone can then claim it. Links to your old address stop
          working.
        </p>
      ) : null}
    </form>
  )
}

export function PublicProfilePanel() {
  const { profile, isLoading, isError } = useProfile()
  const claim = useClaimHandle()
  const rename = useRenameHandle()
  const setVisibility = useSetProfileVisibility()

  const [isRenaming, setIsRenaming] = useState(false)
  const [isConfirmingPublic, setIsConfirmingPublic] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isSpotlit, setIsSpotlit] = useState(false)
  const [isCelebrating, setIsCelebrating] = useState(false)

  const isSummoned = useLocation({ select: (location) => location.hash === PUBLIC_PROFILE_HASH })
  const sectionRef = useRef<HTMLElement>(null)
  const claimFieldRef = useRef<HTMLInputElement>(null)

  const isPublic = profile?.visibility === "public"
  const isClaimable = !isLoading && !isError && profile === null
  const profileUrl = profile ? publicProfileUrl(profile.handle) : ""

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setPanelError("Could not copy the link.")
    }
  }

  const claimHandle = (handle: string) => {
    setPanelError(null)
    claim.mutate(handle, {
      onSuccess: () => {
        setIsCelebrating(true)
        // The question comes with the address, not after it. The flare is the
        // card celebrating behind the answer the reader is already reading.
        setIsConfirmingPublic(true)
      },
      onError: (cause) => setPanelError(errorMessageOf(cause, "Could not claim this handle.")),
    })
  }

  // The flare outlives the claim form it started in: the aurora stays mounted
  // through it, so the card does not go dark in the same frame the address
  // appears.
  useEffect(() => {
    if (!isCelebrating) return
    const timer = setTimeout(() => setIsCelebrating(false), CLAIM_FLARE_MS)
    return () => clearTimeout(timer)
  }, [isCelebrating])

  const renameHandle = (handle: string) => {
    setPanelError(null)
    rename.mutate(handle, {
      onSuccess: () => setIsRenaming(false),
      onError: (cause) => setPanelError(errorMessageOf(cause, "Could not change this handle.")),
    })
  }

  const publish = () => {
    setPanelError(null)
    setVisibility.mutate("public", {
      onSuccess: () => setIsConfirmingPublic(false),
      onError: (cause) => setPanelError(errorMessageOf(cause, "Could not make your profile public.")),
    })
  }

  // Arriving by hash is the reader saying "take me to this card". Wait for the
  // profile to answer before acting: while it loads, the card is a single line
  // with no field to focus, and it would grow under a scroll that already
  // landed. An answer that failed still carries the reader down, because the
  // reason they cannot go on is written in this card.
  useEffect(() => {
    if (!isSummoned || isLoading) return
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    sectionRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
    // The field is the next step, so put the cursor in it. `preventScroll`
    // keeps focus from fighting the smooth scroll it would otherwise cut short.
    claimFieldRef.current?.focus({ preventScroll: true })
    setIsSpotlit(true)
    const timer = setTimeout(() => setIsSpotlit(false), SPOTLIGHT_MS)
    return () => clearTimeout(timer)
  }, [isSummoned, isLoading])

  // Turning the page off is never gated. One click hides it.
  const unpublish = () => {
    setPanelError(null)
    setIsConfirmingPublic(false)
    setVisibility.mutate("private", {
      onError: (cause) => setPanelError(errorMessageOf(cause, "Could not make your profile private.")),
    })
  }

  return (
    <section
      className={clsx(
        "settings-section",
        styles.panel,
        isSpotlit && styles.spotlight,
        isCelebrating && styles.celebrating,
      )}
      id={PUBLIC_PROFILE_HASH}
      ref={sectionRef}
    >
      {/* The card that offers a page of your own wears the page's own light:
          the Inbox aurora, dimmed to a wash a settings card can carry. It is
          the one living card in the column, which is what makes it findable
          when the sidebar sends a reader here. Once a Handle exists, the card
          is a set of controls rather than an offer, and the light goes out. */}
      {isClaimable || isCelebrating ? <AuroraBackground className={styles.shader} /> : null}

      <div className="section-header">
        <div>
          <h2 className="section-title">Public Profile</h2>
          <p className="section-description">Show what you save on a page of your own</p>
        </div>
      </div>

      <div className="settings-stack">
        {isLoading ? <p className="settings-empty">Loading…</p> : null}
        {isError ? <p className="settings-empty">Could not load your public profile.</p> : null}

        {!isLoading && !isError && profile === null ? (
          <>
            <p className={styles.intro}>
              Choose a handle to hold your page address. Your handle is yours from that moment, and your profile
              stays private until you make it public yourself.
            </p>
            <HandleForm
              mode="claim"
              currentHandle={null}
              isPending={claim.isPending}
              onSubmit={claimHandle}
              fieldRef={claimFieldRef}
            />
          </>
        ) : null}

        {!isLoading && !isError && profile !== null ? (
          <>
            <div className={clsx(styles.summary, isCelebrating && styles["summary-arriving"])}>
              <div className={styles["summary-body"]}>
                <span className={styles.url}>{displayProfileUrl(profile.handle)}</span>
                <span className={styles.state}>
                  {isPublic
                    ? "Public. Anyone with this link can read your page."
                    : "Private. Nobody can reach this address, and your handle stays reserved for you."}
                </span>
              </div>
              {isPublic ? (
                <div className={styles["summary-actions"]}>
                  <Button variant="ghost" type="button" onClick={() => void copyUrl()}>
                    {isCopied ? "Copied" : "Copy link"}
                  </Button>
                  <a className={styles.open} href={profileUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
              ) : null}
            </div>

            {isRenaming ? (
              <HandleForm
                mode="rename"
                currentHandle={profile.handle}
                isPending={rename.isPending}
                onSubmit={renameHandle}
                onCancel={() => setIsRenaming(false)}
              />
            ) : null}

            {isConfirmingPublic ? (
              <div className={clsx(styles.confirm, styles["confirm-arriving"])}>
                <h3 className={styles["confirm-title"]}>Before you make your profile public</h3>
                <ul className={styles["confirm-list"]}>
                  <li>
                    This publishes nothing on its own. Your library stays private until you publish a folder.
                  </li>
                  <li>
                    You choose what appears. Publish a folder from its menu, and everything in it shows on your
                    page. Remove it, and it is gone from the page at once.
                  </li>
                  <li>
                    An item you file in no folder never appears, so a save that files nothing publishes nothing.
                  </li>
                  <li>
                    Your page becomes {displayProfileUrl(profile.handle)}. Anyone with the link can read it, and
                    search engines can show it in their results.
                  </li>
                </ul>
                <p className={styles["confirm-footnote"]}>
                  You can turn this off at any time. Your page disappears immediately, and your handle stays
                  reserved for you.
                </p>
                <div className={styles["confirm-actions"]}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsConfirmingPublic(false)}
                    disabled={setVisibility.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={publish} disabled={setVisibility.isPending}>
                    {setVisibility.isPending ? "Publishing…" : "Yes, make my profile public"}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* One question at a time. While the confirmation is open it is the
                only thing to answer, so the row it replaces goes away whole
                rather than leaving a stray button under it. Cancel brings it
                back. */}
            {isConfirmingPublic ? null : (
              <div className={styles.controls}>
                {isPublic ? (
                  <Button variant="ghost" type="button" onClick={unpublish} disabled={setVisibility.isPending}>
                    {setVisibility.isPending ? "Turning off…" : "Turn off my public profile"}
                  </Button>
                ) : (
                  <Button type="button" onClick={() => setIsConfirmingPublic(true)}>
                    Make my profile public
                  </Button>
                )}
                {isRenaming ? null : (
                  <Button variant="ghost" type="button" onClick={() => setIsRenaming(true)}>
                    Change handle
                  </Button>
                )}
              </div>
            )}
          </>
        ) : null}

        {panelError ? <pre className="settings-error">{panelError}</pre> : null}
      </div>
    </section>
  )
}
