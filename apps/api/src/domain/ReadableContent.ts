import { Schema } from "effect"

import { LinkId } from "./SavedItem.js"

/**
 * Which extractor produced a Link's Readable Content. One value today: the
 * column records provenance so a second extractor, or a re-conversion, can be
 * told apart from what Readability produced (see ADR 0021).
 */
export const ReadableContentSource = Schema.Literals(["readability"])
export type ReadableContentSource = typeof ReadableContentSource.Type

/**
 * A Link's Readable Content as anything outside storage may hold it: the
 * Markdown form only.
 *
 * The article HTML is stored beside the Markdown so a better conversion can be
 * run later without fetching the page again, and it is never served. Leaving it
 * off this class is what makes that a type error rather than a convention.
 */
export class ReadableContent extends Schema.Class<ReadableContent>(
  "ReadableContent",
)({
  linkId: LinkId,
  markdown: Schema.String,
  source: ReadableContentSource,
  extractedAt: Schema.Date,
}) {}
