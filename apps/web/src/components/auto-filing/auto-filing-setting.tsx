import { useAccountSettings, useUpdateAccountSettings } from "../../sleevy/account-settings"
import { Switch } from "../ui/switch/switch"
import { OrganizeLibrary } from "./organize-library"

/**
 * Auto-Filing, said the way a person would: new saves go into a folder.
 *
 * The line under the label says the two things a person worries about before
 * turning it on: that Sleevy will not make folders of its own, and that a save
 * that fits nowhere is left alone. The switch is held back until the Account's
 * value is known, so it never shows a state and then flips.
 */
export function AutoFilingPanel() {
  const settings = useAccountSettings()
  const update = useUpdateAccountSettings()

  return (
    <section className="settings-section">
      <div className="section-header">
        <h2 className="section-title">Organizing</h2>
        <p className="section-description">Applies to every device you save from.</p>
      </div>

      {settings.data ? (
        <Switch
          label="Sort new saves into folders"
          description="A new save goes into one of your folders when it clearly fits. This never makes new folders, and a save that fits none stays unfiled."
          checked={settings.data.autoFiling}
          onChange={(checked) => update.mutate({ autoFiling: checked })}
        />
      ) : null}

      <OrganizeLibrary />
    </section>
  )
}
