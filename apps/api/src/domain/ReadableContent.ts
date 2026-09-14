import { Schema } from "effect"

import { LinkId } from "./SavedItem.js"

/**
 * Where a Link's Readable Content came from. Local extraction is the default;
 * Cloudflare is the escalation for a page the fetch path already judged
 * low-confidence (see ADR 0021).
 */
export const ReadableContentSource = Schema.Literals([
  "readability",
  "cloudflare-markdown",
])
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
