import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"

import {
  applyImageCheck,
  ImageCheck,
  imageCheckUrl,
  judgeImageResponse,
} from "../../src/modules/metadata/ImageCheck.js"
import { AppConfig } from "../../src/runtime/Config.js"

describe("imageCheckUrl", () => {
  test("asks for a plain-http address over https", () => {
    expect(imageCheckUrl("http://example.com/og.png")).toBe("https://example.com/og.png")
  })

  test("keeps an https address", () => {
    expect(imageCheckUrl("https://example.com/og.png?v=2")).toBe("https://example.com/og.png?v=2")
  })

  test("makes no request for a data URL or for something that is not a URL", () => {
    expect(imageCheckUrl("data:image/png;base64,AAAA")).toBeUndefined()
    expect(imageCheckUrl("not a url")).toBeUndefined()
  })
})

describe("judgeImageResponse", () => {
  const judge = (status: number, contentType: string | null = "image/png") =>
    judgeImageResponse({ status, finalUrl: "https://cdn.example.com/a.png", contentType })

  test("an image is valid at the address the redirects ended at", () => {
    expect(judge(200)).toEqual({ _tag: "valid", url: "https://cdn.example.com/a.png" })
    expect(judge(200, null)).toEqual({ _tag: "valid", url: "https://cdn.example.com/a.png" })
  })

  test("a web page where an image should be is broken", () => {
    expect(judge(200, "text/html; charset=utf-8")).toEqual({ _tag: "broken" })
  })

  test("a missing, gone, or forbidden image is broken", () => {
    for (const status of [400, 401, 403, 404, 410]) {
      expect(judge(status, "text/html")).toEqual({ _tag: "broken" })
    }
  })

  test("a rate limit, a timeout, or a server error says nothing about the image", () => {
    for (const status of [408, 425, 429, 500, 502, 503, 310]) {
      expect(judge(status, "text/html")).toEqual({ _tag: "unknown" })
    }
  })
})

describe("applyImageCheck", () => {
  test("replaces valid, removes broken, and keeps unknown addresses", () => {
    const results = new Map([
      ["http://a.test/og.png", { _tag: "valid", url: "https://a.test/og.png" }],
      ["https://a.test/gone.png", { _tag: "broken" }],
      ["https://a.test/busy.png", { _tag: "unknown" }],
    ] as const)

    expect(
      applyImageCheck(
        {
          imageUrl: "http://a.test/og.png",
          authorAvatarUrl: "https://a.test/gone.png",
          faviconUrl: "https://a.test/busy.png",
          faviconDarkUrl: "https://a.test/gone.png",
        },
        results,
      ),
    ).toEqual({
      imageUrl: "https://a.test/og.png",
      authorAvatarUrl: undefined,
      faviconUrl: "https://a.test/busy.png",
      faviconLightUrl: undefined,
      faviconDarkUrl: undefined,
    })
  })
})

describe("ImageCheck", () => {
  let server: ReturnType<typeof Bun.serve>
  const requests: string[] = []

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const { pathname } = new URL(request.url)
        requests.push(pathname)
        switch (pathname) {
          case "/og.png":
            return new Response(new Uint8Array(1024), { headers: { "content-type": "image/png" } })
          case "/moved.png":
            return Response.redirect(new URL("/og.png", request.url).toString(), 301)
          case "/gone.png":
            return new Response("Gone", { status: 410 })
          case "/busy.png":
            return new Response("Too Many Requests", { status: 429 })
          case "/page.png":
            return new Response("<!doctype html>", { headers: { "content-type": "text/html" } })
          default:
            return new Response("Not Found", { status: 404 })
        }
      },
    })
  })

  afterAll(() => {
    server.stop(true)
  })

  const run = <A>(effect: Effect.Effect<A, never, ImageCheck>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provide(
          ImageCheck.layer.pipe(
            Layer.provide(
              Layer.succeed(
                AppConfig,
                { fetch: { timeoutMs: 2_000, userAgent: "test" } } as unknown as AppConfig["Service"],
              ),
            ),
          ),
        ),
      ),
    )

  // The local server speaks plain http; the check asks for https, so the
  // test below routes the https form back to it.
  const local = (path: string) => `http://localhost:${server.port}${path}`

  test("checks each address once and applies what the server answers", async () => {
    const originalFetch = globalThis.fetch
    // Route the https form the check asks for back to the local http server.
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      originalFetch(String(input).replace(/^https:/, "http:"), init)) as typeof fetch

    try {
      const result = await run(
        ImageCheck.use((check) =>
          check.checkImages({
            imageUrl: local("/moved.png"),
            authorAvatarUrl: local("/gone.png"),
            faviconUrl: local("/busy.png"),
            faviconLightUrl: local("/page.png"),
            faviconDarkUrl: local("/gone.png"),
          }),
        ),
      )

      expect(result).toEqual({
        imageUrl: local("/og.png"),
        authorAvatarUrl: undefined,
        faviconUrl: local("/busy.png"),
        faviconLightUrl: undefined,
        faviconDarkUrl: undefined,
      })
      // /gone.png is named twice and requested once.
      expect(requests.filter((path) => path === "/gone.png")).toHaveLength(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("keeps an address whose host cannot be reached", async () => {
    const result = await run(
      ImageCheck.use((check) => check.check("https://image-check.invalid/og.png")),
    )
    expect(result).toEqual({ _tag: "unknown" })
  })
})
