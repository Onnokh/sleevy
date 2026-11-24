import { Context, Effect, Layer } from "effect"

import { AppConfig } from "../../runtime/Config.js"

// The Image Check: one request to each External Image URL that Link Metadata
// names, made when the Link is enriched, so that a client is not given an image
// address that is already known to be broken or to redirect.
//
// The image stays an External Image URL. Sleevy keeps no copy of it and serves
// no proxy for it; the check only decides which address, if any, is stored.
//
// The answer has three values, because "the request failed" does not always
// mean "the image is gone":
//
//   * valid   — the address answers with an image. The address to store is the
//               one the redirects ended at, over https when the image is
//               reachable there, so a client loads it without a redirect.
//   * broken  — the address answers that the image does not exist or may not
//               be read (404, 410, 403, and the other 4xx), or answers with a
//               web page instead of an image. The address is dropped, and a
//               client draws its fallback instead of a broken image.
//   * unknown — the address is rate limited (429), the server had a problem
//               (5xx), or the request did not complete. Nothing is known about
//               the image, so the stored address is kept as it is. Dropping it
//               would remove a working image because of a busy server.
export type ImageCheckResult =
  | { readonly _tag: "valid"; readonly url: string }
  | { readonly _tag: "broken" }
  | { readonly _tag: "unknown" }

const valid = (url: string): ImageCheckResult => ({ _tag: "valid", url })
const broken: ImageCheckResult = { _tag: "broken" }
const unknown: ImageCheckResult = { _tag: "unknown" }

// The status codes that say nothing about the image itself: the server asks
// for time, or for fewer requests.
const TRANSIENT_CLIENT_STATUSES = new Set([408, 425, 429])

/**
 * The address the check requests for a stored image address. A plain-http
 * address is asked for over https: a Public Profile is served over https, so a
 * client loads the https form in any case, and that is the form to check and to
 * store. Anything that is not an http(s) URL, such as a `data:` favicon, is not
 * a request to make and gets `undefined`.
 */
export const imageCheckUrl = (stored: string): string | undefined => {
  let url: URL
  try {
    url = new URL(stored)
  } catch {
    return undefined
  }
  if (url.protocol === "http:") url.protocol = "https:"
  return url.protocol === "https:" ? url.toString() : undefined
}

/** What an image response says about the image. Pure, so the rules are tested alone. */
export const judgeImageResponse = (response: {
  readonly status: number
  readonly finalUrl: string
  readonly contentType: string | null
}): ImageCheckResult => {
  const { status } = response

  if (status >= 200 && status < 300) {
    // A web page where an image should be: a single-page app that answers
    // every path, or a host that sends a soft 404. A client cannot draw it.
    const contentType = (response.contentType ?? "").toLowerCase()
    if (contentType.startsWith("text/html")) return broken
    return valid(response.finalUrl)
  }

  if (TRANSIENT_CLIENT_STATUSES.has(status)) return unknown
  if (status >= 400 && status < 500) return broken
  // 5xx, and a 3xx that fetch did not follow (a loop or a bad Location).
  return unknown
}

// The Link Metadata fields that hold an External Image URL.
export const LINK_IMAGE_FIELDS = [
  "imageUrl",
  "authorAvatarUrl",
  "faviconUrl",
  "faviconLightUrl",
  "faviconDarkUrl",
] as const

export type LinkImages = {
  readonly [Field in (typeof LINK_IMAGE_FIELDS)[number]]?: string | undefined
}

/** The image fields after the check: valid → resolved address, broken → removed, unknown → kept. */
export const applyImageCheck = (
  images: LinkImages,
  results: ReadonlyMap<string, ImageCheckResult>,
): Required<LinkImages> => {
  const resolved = (value: string | undefined) => {
    if (value === undefined) return undefined
    const result = results.get(value)
    if (result?._tag === "valid") return result.url
    if (result?._tag === "broken") return undefined
    return value
  }

  return {
    imageUrl: resolved(images.imageUrl),
    authorAvatarUrl: resolved(images.authorAvatarUrl),
    faviconUrl: resolved(images.faviconUrl),
    faviconLightUrl: resolved(images.faviconLightUrl),
    faviconDarkUrl: resolved(images.faviconDarkUrl),
  }
}

export class ImageCheck extends Context.Service<ImageCheck>()(
  "@app/modules/metadata/ImageCheck",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig

      const check = Effect.fn("ImageCheck.check")(function* (stored: string) {
        const requestUrl = imageCheckUrl(stored)
        // Not a URL to request, such as a `data:` favicon: there is nothing to
        // learn, so it stays as it is.
        if (requestUrl === undefined) return unknown
        yield* Effect.annotateCurrentSpan("url", requestUrl)

        return yield* Effect.promise(async (): Promise<ImageCheckResult> => {
          const abortController = new AbortController()
          const timeout = setTimeout(() => abortController.abort(), config.fetch.timeoutMs)

          try {
            // GET rather than HEAD: many image endpoints, generated Open Graph
            // images among them, answer HEAD with 404 or 405 while GET works.
            // The body is cancelled unread, so only the headers are paid for.
            const response = await globalThis.fetch(requestUrl, {
              headers: {
                "user-agent": config.fetch.userAgent,
                accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
              },
              redirect: "follow",
              signal: abortController.signal,
            })
            await response.body?.cancel().catch(() => undefined)

            return judgeImageResponse({
              status: response.status,
              finalUrl: response.url || requestUrl,
              contentType: response.headers.get("content-type"),
            })
          } catch {
            // A timeout, a DNS failure, or a TLS failure on the https form.
            return unknown
          } finally {
            clearTimeout(timeout)
          }
        })
      })

      return {
        check,

        /**
         * The image addresses of one Link checked: the image, the Link Author
         * avatar, and the favicon variants. A valid address is replaced by the
         * address it resolved to, a broken one is removed, and an unknown one
         * is kept. The checks run side by side, and one address that appears
         * in two fields is requested once.
         */
        checkImages: Effect.fn("ImageCheck.checkImages")(function* (images: LinkImages) {
          const addresses = [
            ...new Set(
              LINK_IMAGE_FIELDS
                .map((field) => images[field])
                .filter((value): value is string => value !== undefined),
            ),
          ]

          const results = new Map(
            yield* Effect.forEach(
              addresses,
              (address) => check(address).pipe(Effect.map((result) => [address, result] as const)),
              { concurrency: 5 },
            ),
          )

          return applyImageCheck(images, results)
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(ImageCheck, ImageCheck.make)

  static readonly defaultLayer = ImageCheck.layer.pipe(Layer.provide(AppConfig.layer))
}
