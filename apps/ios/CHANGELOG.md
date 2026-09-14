# Sleevy iOS Changelog

## 1.0.6 - 2026-09-14

- Fixed the header card on the Inbox, folder, and profile screens drifting away from the list after a pull-to-refresh or a scroll, which could leave the "saves · unread" line and the card's edge over the first row. The card now follows the first row directly.

## 1.0.4 - 2026-05-30

- Redesigned the Library folders area as a distinct, grouped section of rows with a "Show all" shortcut when you have more folders than fit.
- Fixed long-pressing a folder so the pressed folder is highlighted correctly and its Rename and Delete actions apply to the right folder.
- Long folder names now display in full instead of being truncated.
- Fixed marking items as read or unread so the change saves reliably.

## 1.0.3 - 2026-05-24

- Fixed an issue where the Inbox title could appear clipped when first opening an empty inbox.
- Refreshed the Inbox automatically after returning to Sleevy from sharing a new link.
- Restored pull-to-refresh when the Inbox has no unread items, with the empty state scrolling naturally during the gesture.

## 1.0.2 - 2026-05-22

- Prepared the iOS app release linked from the Sleevy App Store listing.

## 1.0.1 - 2026-05-20

- Improved compatibility for the reading list on iOS 18.
- Fixed search loading states that could remain active or repeatedly retry.

## 1.0.0

- Initial iOS app and Share Extension release.
- Added the Inbox, library, search, settings, and in-app link capture flows.
- Added account sign-in, offline synchronization, and native sharing support.
