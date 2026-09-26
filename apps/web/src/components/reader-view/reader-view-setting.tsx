import { setReaderViewDisabled, useReaderViewDisabled } from "../../sleevy/reader-preference"
import { Switch } from "../ui/switch/switch"

/**
 * The Reader View is on by default, so the setting is phrased as the thing it
 * turns off rather than as a negative to be switched on.
 *
 * Each line says one thing once: the header says how far the setting reaches,
 * the label says what it does, and the line under it says the part that is not
 * obvious from either. The text does not report the switch's own state — the
 * switch is already showing it, and a description that changed with it read as
 * a third copy of the same sentence.
 */
export function ReaderViewPanel() {
  const disabled = useReaderViewDisabled()

  return (
    <section className="settings-section">
      <div className="section-header">
        <h2 className="section-title">Reading</h2>
        <p className="section-description">Applies to this browser only.</p>
      </div>

      <Switch
        label="Open items in the Reader View"
        description="Items without a readable article always open in a new tab."
        checked={!disabled}
        onChange={(checked) => setReaderViewDisabled(!checked)}
      />
    </section>
  )
}
