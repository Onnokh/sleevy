/**
 * The plugin ships CommonJS with no types of its own. Only the table rules are
 * used, so only they are declared: `gfm` bundles a `highlightedCodeBlock` rule
 * that would race the converter's own fenced-code rule, and the rest of the
 * pack is not needed.
 */
declare module "@joplin/turndown-plugin-gfm" {
  import type TurndownService from "turndown"

  export const tables: TurndownService.Plugin
}
