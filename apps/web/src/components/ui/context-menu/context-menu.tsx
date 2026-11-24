import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import clsx from "clsx"
import { Check, ChevronRight } from "lucide-react"
import { Fragment, type ReactNode } from "react"

import styles from "./context-menu.module.scss"

export type ContextMenuItem = {
  readonly key: string
  readonly label: string
  readonly destructive?: boolean
  readonly disabled?: boolean
  readonly href?: string
  readonly onClick?: () => void
  readonly items?: readonly ContextMenuItem[]
  /** The option in force, in a menu of choices: marked with a check. */
  readonly checked?: boolean
  /** A line above this item, between two groups of a menu. */
  readonly separated?: boolean
}

type ContextMenuProps = {
  readonly items: readonly ContextMenuItem[]
  readonly triggerLabel?: ReactNode
  readonly align?: "left" | "right"
  readonly side?: "top" | "bottom"
  readonly triggerClassName?: string
  readonly triggerAriaLabel?: string
  readonly menuClassName?: string
}

const menuItemClassName = (item: ContextMenuItem) =>
  clsx(styles["menu-item"], item.destructive && styles.destructive)

function MenuItems({ items }: { readonly items: readonly ContextMenuItem[] }) {
  return items.map((item) => (
    <Fragment key={item.key}>
      {item.separated ? <DropdownMenu.Separator className={styles.separator} /> : null}
      <MenuItem item={item} />
    </Fragment>
  ))
}

function MenuItem({ item }: { readonly item: ContextMenuItem }) {
  if (item.items?.length) {
    return (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger
          disabled={item.disabled}
          className={styles["menu-item"]}
        >
          <span>{item.label}</span>
          {item.items.some((option) => option.checked) ? (
            <span className={styles.value}>{item.items.find((option) => option.checked)?.label}</span>
          ) : null}
          <ChevronRight size={14} className={styles.chevron} />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent className={clsx(styles.menu, styles.submenu)} sideOffset={4} alignOffset={-4}>
            <MenuItems items={item.items} />
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    )
  }

  if (item.href) {
    return (
      <DropdownMenu.Item asChild onSelect={item.onClick} disabled={item.disabled}>
        <a href={item.href} target="_blank" rel="noreferrer" className={menuItemClassName(item)}>
          {item.label}
        </a>
      </DropdownMenu.Item>
    )
  }

  return (
    <DropdownMenu.Item
      disabled={item.disabled}
      className={menuItemClassName(item)}
      onSelect={item.onClick}
    >
      {item.label}
      {item.checked ? <Check size={14} className={styles.check} aria-label="Selected" /> : null}
    </DropdownMenu.Item>
  )
}

export function ContextMenu({
  items,
  triggerLabel,
  align = "right",
  side = "bottom",
  triggerClassName,
  triggerAriaLabel = "Open menu",
  menuClassName,
}: ContextMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={triggerClassName} aria-label={triggerAriaLabel}>
          {triggerLabel}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={align === "left" ? "start" : "end"}
          sideOffset={4}
          className={clsx(styles.menu, menuClassName)}
        >
          <MenuItems items={items} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
