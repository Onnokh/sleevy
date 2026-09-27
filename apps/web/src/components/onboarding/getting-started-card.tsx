import { type ReactNode, useState } from "react"
import clsx from "clsx"
import { Check, QrCode, X } from "lucide-react"
import { m } from "motion/react"

import { useHotkeyLabel } from "../../hooks/use-hotkey-label"
import type { GettingStartedStep, GettingStartedStepKey } from "../../sleevy/onboarding"
import { IphoneHandOff } from "./iphone-hand-off"
import styles from "./getting-started-card.module.scss"

type StepCopy = {
  readonly title: string
  readonly todo: string
  readonly done: string
  readonly marker: ReactNode
}

const kbd = (...keys: string[]) => (
  <span className={styles.keys}>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span>
)

const PaletteKeys = () => kbd(useHotkeyLabel("Mod+K"))

const STEP_COPY: Record<GettingStartedStepKey, StepCopy> = {
  save: {
    title: "Save a link",
    todo: "Paste one in the Inbox, or press N.",
    done: "Your first link is saved.",
    marker: kbd("N"),
  },
  open: {
    title: "Open it",
    todo: "Select it with J and K, then press O.",
    done: "Read items move to your Library.",
    marker: kbd("O"),
  },
  palette: {
    title: "Find anything",
    todo: "Search, jump, and save from one place.",
    done: "The Command Palette is always one key away.",
    marker: <PaletteKeys />,
  },
  iphone: {
    title: "Get Sleevy on your iPhone",
    todo: "Save from any app with the share button.",
    done: "Saves from your iPhone land here too.",
    marker: <QrCode size={18} strokeWidth={1.8} aria-hidden="true" />,
  },
}

/**
 * The Getting Started Card: four steps that follow the first save, above the
 * Inbox rows. It checks itself off as the person uses Sleevy, closes itself
 * when every step is done, and can be put away earlier and brought back from
 * the Command Palette.
 */
export function GettingStartedCard({ steps, opens, onDismiss, onStep, onIphoneDone }: {
  readonly steps: readonly GettingStartedStep[]
  /** Whether it opens with motion: right after the first save, not on a page load. */
  readonly opens: boolean
  readonly onDismiss: () => void
  readonly onStep: (key: Exclude<GettingStartedStepKey, "iphone">) => void
  /** The iPhone step, closed by hand: checked off, or its hand-off closed. */
  readonly onIphoneDone: () => void
}) {
  const [handOffOpen, setHandOffOpen] = useState(false)
  const doneCount = steps.filter((step) => step.done).length

  const select = (key: GettingStartedStepKey) => {
    if (key === "iphone") setHandOffOpen(true)
    else onStep(key)
  }

  // Having seen the code is as far as this computer can take the step, so
  // closing the hand-off, however it is closed, finishes it here.
  const changeHandOff = (open: boolean) => {
    setHandOffOpen(open)
    if (!open) onIphoneDone()
  }

  return (
    // Opens to its height rather than appearing at it, so the rows under it
    // slide down instead of jumping — most of all right after the first save
    // has folded into its row.
    <m.div
      className={styles.opening}
      initial={opens ? { height: 0, opacity: 0 } : false}
      animate={{ height: "auto", opacity: 1 }}
      transition={{ height: { type: "spring", duration: 0.55, bounce: 0, delay: 0.15 }, opacity: { duration: 0.3, delay: 0.3 } }}
    >
    <section className={styles.card} aria-labelledby="getting-started-title">
      <header className={styles.header}>
        <h2 id="getting-started-title" className={styles.title}>Getting started</h2>
        <span className={styles.progress}>{doneCount} of {steps.length}</span>
        <button type="button" className={styles.dismiss} aria-label="Hide Getting started" onClick={onDismiss}>
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <ol className={styles.steps}>
        {steps.map((step) => {
          const copy = STEP_COPY[step.key]
          const checksByHand = step.key === "iphone" && !step.done
          return (
            <li key={step.key} className={styles.stepItem}>
              {/* The one step that can be checked off by hand. Its button sits
                  over the tile's circle rather than inside the tile, which is
                  a button of its own. */}
              {checksByHand ? (
                <button type="button" className={styles.checkByHand} aria-label={`Mark "${copy.title}" as done`} onClick={onIphoneDone}>
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                className={clsx(styles.step, step.done && styles.done)}
                disabled={step.done && step.key !== "iphone"}
                onClick={() => select(step.key)}
              >
                <span className={styles.stepTop}>
                  {step.done ? (
                    <span className={styles.check} aria-label="Done"><Check size={13} strokeWidth={3} /></span>
                  ) : (
                    <span className={styles.circle} aria-hidden="true" />
                  )}
                  {step.done ? null : <span className={styles.marker}>{copy.marker}</span>}
                </span>
                <span className={styles.stepTitle}>{copy.title}</span>
                <span className={styles.stepHint}>{step.done ? copy.done : copy.todo}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <IphoneHandOff open={handOffOpen} onOpenChange={changeHandOff} />
    </section>
    </m.div>
  )
}
