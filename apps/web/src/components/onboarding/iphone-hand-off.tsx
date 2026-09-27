import * as Dialog from "@radix-ui/react-dialog"
import { CircleUserRound, MonitorSmartphone, Share } from "lucide-react"

import { GlassBackground } from "../marketing/glass-background/glass-background"
import { appStoreUrl } from "../marketing/store-links"
import { QrCode } from "./qr-code"
import styles from "./iphone-hand-off.module.scss"

/**
 * Sends a desktop reader to the iPhone app, where saving from any app is one
 * tap in the share sheet. A code to scan rather than a link to type, because
 * the phone is the device that has to open it.
 *
 * It speaks the homepage's language — the lit glass, the headline, the white
 * App Store button, the phone — because it is the same invitation, made from
 * inside the product.
 */
export function IphoneHandOff({ open, onOpenChange }: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          {/* The panel is the glass's host, so the pointer lights it
              wherever it moves over the dialog. Ribbons at the hero's size:
              the panel draws a band across a scene as tall as the hero. */}
          <GlassBackground sceneHeightRem={56} />
          <div className={styles.shade} aria-hidden="true" />

          <div className={styles.content}>
            <p className={styles.eyebrow}>
              <AppleIcon />
              Sleevy for iPhone
            </p>
            <Dialog.Title className={styles.title}>
              Save it on your iPhone. <br />
              Read it here.
            </Dialog.Title>
            {/* Three things to know, one per line, rather than one sentence
                that has to carry all three — in the order they happen. */}
            <ol className={styles.points}>
              <li>
                <span className={styles.pointIcon}><CircleUserRound size={15} strokeWidth={1.75} aria-hidden="true" /></span>
                Sign in with the account you use here.
              </li>
              <li>
                <span className={styles.pointIcon}><Share size={15} strokeWidth={1.75} aria-hidden="true" /></span>
                Tap Share in any app, then Sleevy.
              </li>
              <li>
                <span className={styles.pointIcon}><MonitorSmartphone size={15} strokeWidth={1.75} aria-hidden="true" /></span>
                What you save shows up on both.
              </li>
            </ol>

            <div className={styles.actions}>
              <a className={styles.primary} href={appStoreUrl} target="_blank" rel="noreferrer">
                <AppleIcon />
                Open the App Store
              </a>
              <Dialog.Close className={styles.secondary}>
                Not now <kbd>esc</kbd>
              </Dialog.Close>
            </div>
          </div>

          {/* The one thing to do here, so it is the largest thing here: on the
              lit side of the glass, where the eye goes first. A code needs no
              caption; the App Store button says where it leads. */}
          <div className={styles.codeStage}>
            <div className={styles.code}>
              <QrCode value={appStoreUrl} label="QR code for Sleevy on the App Store" />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function AppleIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M12.665 15.358c-.905.844-1.893.711-2.843.311-1.006-.409-1.93-.427-2.991 0-1.33.551-2.03.391-2.825-.31C-.498 10.886.166 4.078 5.28 3.83c1.246.062 2.114.657 2.843.71 1.09-.213 2.133-.826 3.296-.746 1.393.107 2.446.64 3.138 1.6-2.88 1.662-2.197 5.315.443 6.337-.526 1.333-1.21 2.657-2.345 3.635zM8.03 3.778C7.892 1.794 9.563.16 11.483 0c.268 2.293-2.16 4-3.452 3.777" />
    </svg>
  )
}
