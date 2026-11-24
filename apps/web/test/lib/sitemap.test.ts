import { describe, expect, test } from "bun:test"

import { profileSitemapUrls, renderSitemap } from "../../src/lib/sitemap"

describe("profileSitemapUrls", () => {
  test("lists every numbered page of a Public Profile", () => {
    const urls = profileSitemapUrls({
      handle: "onno",
      lastModifiedAt: "2026-11-20T09:30:00.000Z",
      savedItemPageCount: 3,
    })

    expect(urls.map((url) => url.loc)).toEqual([
      "https://sleevy.app/u/onno",
      "https://sleevy.app/u/onno?page=2",
      "https://sleevy.app/u/onno?page=3",
    ])
    expect(urls.every((url) => url.lastmod === "2026-11-20")).toBe(true)
    expect(urls.map((url) => url.priority)).toEqual(["0.5", "0.3", "0.3"])
  })

  test("lists page 1 alone when the API states no page count", () => {
    expect(
      profileSitemapUrls({ handle: "onno", lastModifiedAt: "2026-11-20T09:30:00.000Z" })
        .map((url) => url.loc),
    ).toEqual(["https://sleevy.app/u/onno"])
  })

  test("escapes nothing it does not have to in the rendered document", () => {
    const xml = renderSitemap(
      profileSitemapUrls({
        handle: "onno",
        lastModifiedAt: "2026-11-20T09:30:00.000Z",
        savedItemPageCount: 2,
      }),
    )
    expect(xml).toContain("<loc>https://sleevy.app/u/onno?page=2</loc>")
  })
})
