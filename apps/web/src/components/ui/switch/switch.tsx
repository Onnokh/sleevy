import { useId } from "react"

import styles from "./switch.module.scss"

type SwitchProps = {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly label: string
  /** The line under the label, saying what the setting does when it is on. */
  readonly description?: string
}

/**
 * A setting that is on or off.
 *
 * It is a real checkbox behind the track, so the keyboard, the label, and
 * assistive technology all work without anything being reimplemented; only the
 * appearance is ours. `role="switch"` is what makes a screen reader read it as
 * on and off rather than ticked and unticked.
 */
export function Switch({ checked, onChange, label, description }: SwitchProps) {
  const id = useId()
  const describedBy = description ? `${id}-description` : undefined

  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <label className={styles.label} htmlFor={id}>{label}</label>
        {description ? (
          <p className={styles.description} id={describedBy}>{description}</p>
        ) : null}
      </div>

      <input
        className={styles.input}
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  )
}
