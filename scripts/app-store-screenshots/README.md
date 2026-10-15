# App Store screenshot localization

The ten iPhone and iPad clean backgrounds in `app-store-screenshots/_backgrounds` are exported from the Figma `App Store` page with the marketing text layers temporarily hidden. The Figma file is restored after export; localization happens locally.

The five iPhone Duo backgrounds in `_backgrounds/iphone-duo` are made locally instead: `compose-duo.swift` puts a raw Duo capture (from `scripts/duo-screenshots/run.sh`, in demo mode) in a black bezel on the iPad gradient. Wide shots (2853×2007) show the inner display, tall ones (1398×2034) the cover display.

```sh
swiftc -O scripts/app-store-screenshots/compose-duo.swift -o /tmp/compose-duo
/tmp/compose-duo app-store-screenshots/_backgrounds/ipad/05.png <capture.png> app-store-screenshots/_backgrounds/iphone-duo/01.png 2853 2007 2240 640
```

Render the localized screenshots:

```sh
node scripts/app-store-screenshots/render.mjs
```

This writes:

```text
app-store-screenshots/iphone/en/01.png      … 05.png
app-store-screenshots/ipad/en/01.png        … 05.png
app-store-screenshots/iphone-duo/en/01.png  … 05.png
```

and the same for `nl`. Add a locale by adding one object to `translations.json`; the renderer produces every device and all five screenshots automatically. The CLI also accepts an explicit locale list and `--device` filters, for example `node scripts/app-store-screenshots/render.mjs --device=iphone-duo en nl`.

Core Text draws the text (`text-overlay.swift`, compiled on each run), so Arabic, Hebrew and Urdu run right to left and join, Indic and Thai marks stack, and a glyph the locale's font lacks falls back to a font that has it. The text goes into a transparent overlay that ImageMagick (`magick`) lays over the background. Each line is measured before rendering: Figma-style tighter tracking is applied, and the font size scales down proportionally to keep every translation inside an 88% safe area within its artboard text box.

## Creative asset videos

The App Store creative assets (Asset Library, not screenshots) are two 15-second loops: the 21:9 product page header (`creative-video/01.mp4`, the mark and the name only, the same for every locale) and the 3:2 search results video (`creative-video/<locale>/02.mp4`, the Inbox and the `tapToSave` / `readAnywhere` text). Render them with:

```sh
node scripts/app-store-screenshots/render.mjs --device=creative-video en nl
```

`glass-loop.swift` renders the homepage hero's glass shader offline with Metal, as a seamless loop: the last three seconds cross-fade into the frames just before time 0. `compose-creative.swift` draws the still layer (the mark, or the Inbox capture in `_backgrounds/creative-video/inbox.png` in an iPhone body), and the text goes on top of it. The videos are H.264 with a silent audio track, about 50 MB each, so git ignores `app-store-screenshots/creative-video/`. A full run of all locales takes about half an hour, most of it H.264 encoding. The Inbox capture is a demo-mode screen (`SLEEVY_DEMO_SCREEN=inbox`) from an iPhone simulator in dark mode, en_US, at 9:41.
