import { useState } from "react"
import { X } from "lucide-react"

import { useSavedItems } from "../../sleevy/saved-items"
import { gettingStartedSteps, hasIphoneSaves, useGettingStarted } from "../../sleevy/onboarding"
import { IphoneHandOff } from "./iphone-hand-off"
import styles from "./iphone-card.module.scss"

/**
 * The iPhone Card: a small invitation at the foot of the sidebar for an
 * Account that has not saved anything from the iPhone yet. It opens the same
 * hand-off as the Getting Started Card, and its close button hides it for good
 * in this browser.
 *
 * It stays out of the way while a new Account still has the iPhone step open
 * on its Getting Started Card, so one screen never asks twice.
 */
export function IphoneCard() {
  const { data } = useSavedItems()
  const gettingStarted = useGettingStarted()
  const [handOffOpen, setHandOffOpen] = useState(false)

  // Waits for the Account's state too, so a card hidden for good never
  // flashes up before the answer arrives.
  if (!data || !gettingStarted.isLoaded) return null

  const items = data.savedItems
  const askedOnTheCard = gettingStarted.isNewAccount
    && !gettingStarted.dismissed
    && !gettingStarted.iphoneHandOffSeen
    && gettingStartedSteps(items, gettingStarted).some((step) => !step.done)
  const hidden = gettingStarted.iphoneCardDismissed || hasIphoneSaves(items) || askedOnTheCard

  // The hand-off stays up once opened, even if what it offers is no longer
  // needed while it is open.
  if (hidden && !handOffOpen) return null

  return (
    <div className={styles.card}>
      <span className={styles.glass} aria-hidden="true" />

      <button type="button" className={styles.open} onClick={() => setHandOffOpen(true)}>
        <img className={styles.icon} src="/app-icon-160.webp" alt="" width={160} height={160} />
        <span className={styles.text}>
          <span className={styles.eyebrow}>Sleevy for iPhone</span>
          <span className={styles.title}>Save from any app</span>
        </span>
      </button>

      <button
        type="button"
        className={styles.close}
        aria-label="Hide Sleevy for iPhone for good"
        title="Hide for good"
        onClick={gettingStarted.dismissIphoneCard}
      >
        <X size={12} strokeWidth={2.25} aria-hidden="true" />
      </button>

      <IphoneHandOff open={handOffOpen} onOpenChange={setHandOffOpen} />
    </div>
  )
}
