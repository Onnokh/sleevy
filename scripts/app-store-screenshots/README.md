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
