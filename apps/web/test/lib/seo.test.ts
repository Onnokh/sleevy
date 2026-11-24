import { describe, expect, test } from "bun:test"

import { META_DESCRIPTION_MAX_LENGTH, metaDescription } from "../../src/lib/meta-description"
import { docsSitemapUrls, staticSitemapUrls } from "../../src/lib/sitemap"

describe("metaDescription", () => {
  test("keeps a short summary as it is, without code marks", () => {
    expect(metaDescription("Mark a saved item read with `POST /read`.")).toBe(
      "Mark a saved item read with POST /read.",
    )
  })

  test("cuts a long summary at the last sentence that fits", () => {
    const text =
      "List the authenticated account's Saved Items. Use `sort` to choose the ordering and `folder` to restrict the list to one Folder. Pass `limit` and the `nextCursor` of the previous response to page through the list."
    const result = metaDescription(text)
    expect(result.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH)
    expect(result).toBe(
      "List the authenticated account's Saved Items. Use sort to choose the ordering and folder to restrict the list to one Folder.",
    )
  })

  test("cuts at a whole word when the sentence end leaves too little", () => {
    const text = `Delete a Folder. ${"The Saved Items in it are kept and become unfiled rather than being deleted with it ".repeat(3)}`
    const result = metaDescription(text)
    expect(result.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH)
    expect(result.length).toBeGreaterThan(110)
    expect(result.endsWith("…")).toBe(true)
  })
})

describe("docsSitemapUrls", () => {
  test("lists only the docs pages the fixed list does not name", () => {
    const urls = docsSitemapUrls([
      "/docs",
      "/docs/api-reference/saved-items.list",
      "/docs/api-reference/saved-items.list",
      "/docs/api-reference/folders.create",
    ])
    expect(urls.map((url) => url.loc)).toEqual([
      "https://sleevy.app/docs/api-reference/folders.create",
      "https://sleevy.app/docs/api-reference/saved-items.list",
    ])
    const apiReference = staticSitemapUrls.find((url) => url.loc.endsWith("/docs/api-reference"))
    expect(urls.every((url) => url.lastmod === apiReference?.lastmod)).toBe(true)
  })
})
