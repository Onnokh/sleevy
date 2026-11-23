import type { ReactNode } from "react"

import { saveDateGroups } from "../../sleevy/save-date-groups"
import type { SavedItem } from "../../sleevy/saved-items"
import styles from "./saved-card.module.scss"

type Props = {
  readonly items: readonly SavedItem[]
  /** Under date headings, as the iOS app shows a list sorted by date. */
  readonly groupsByDate: boolean
  /** One row; `index` counts through the whole list, across its groups. */
  readonly renderItem: (item: SavedItem, index: number) => ReactNode
}

/**
 * A list of saves: one run of rows, or runs under date headings (Today,
 * Yesterday, This Week…) while the list is sorted by date. The keyboard
 * selection counts through every row, so the groups do not change it.
 */
export function SavedItemList({ items, groupsByDate, renderItem }: Props) {
  if (!groupsByDate) {
    return (
      <ul className="item-list">
        {items.map((item, index) => <li key={item.id}>{renderItem(item, index)}</li>)}
      </ul>
    )
  }

  let index = 0
  return (
    <div className={styles.groups}>
      {saveDateGroups(items).map((group) => (
        <section key={group.span} className={styles.group} aria-label={group.span}>
          <h2 className={styles.groupHeading}>{group.span}</h2>
          <ul className="item-list">
            {group.items.map((item) => <li key={item.id}>{renderItem(item, index++)}</li>)}
          </ul>
        </section>
      ))}
    </div>
  )
}
