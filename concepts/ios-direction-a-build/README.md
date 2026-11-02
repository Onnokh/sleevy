# Direction A build: screenshots

Contact sheets of the Direction A build on branch `feat/ios-direction-a`.
All data is Demo Mode (Maya Chen, 29 saves, 19 unread). No tile changed data.

| Sheet | Device | Display | Orientation |
| --- | --- | --- | --- |
| 01–04 | iPhone 17 | – | portrait, landscapeRight, portraitUpsideDown, landscapeLeft |
| 05–08 | iPhone Duo, Closed | cover display | same four |
| 09–12 | iPhone Duo, Book | inner display | same four |
| 13–16 | iPhone Duo, Open | inner display | same four |

## How a tile is made

Each tile is a fresh launch:

```
SIMCTL_CHILD_SLEEVY_DEMO_MODE=1 SIMCTL_CHILD_SLEEVY_DEMO_SCREEN=<screen> xcrun simctl launch <udid> app.sleevy
```

`<screen>` is one of `signin inbox library folder tag reader reader-outline search profile settings`.
A screenshot is kept only when two frames in a row are the same, the frame is not the black
launch screen, and it is not the Sign in screen (Demo Mode restores its session a moment
after launch).

## Tap states (iPhone only)

These start from a demo launch of Inbox or Library. Points are in the turned UI.

| Tile | Steps | Portrait | Landscape |
| --- | --- | --- | --- |
| Inbox · row context menu | long-press a row, 1.2 s | (175, 517) | (208, 211) |
| Capture Capsule | tap +, then the field. On a paste prompt, choose Don't Allow Paste | (302, 84) | (752, 46) |
| Library · sort menu | tap the sort button | (300, 84) | (751, 46) |
| Library · Filters | sort menu, then Filters | (238, 282) | (664, 244) |
| New Folder | tap New Folder (landscape: scroll up 100 pt first) | (100, 505) | (163, 336) |

## Notes

- The iPhone does not turn upside-down. A launch in that orientation shows the portrait UI.
  On the Duo cover display the app keeps its last orientation.
- On the Duo, Book mode has no Article Outline on the tall inner display, so the Reader View
  tile with the outline shows only where the outline exists.
- Book and Open give the same pixels: the layout follows the display and the orientation,
  not the hinge angle.
