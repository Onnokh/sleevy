import { Context, Data, Effect, Layer, Option, Schema } from "effect"

import { AppConfig } from "../../runtime/Config.js"
import { READABLE_MARKDOWN_MAX_CHARS } from "./ReadableContentExtractor.js"

// The endpoint takes either the page markup or a URL to go and render. Sleevy
// sends the markup whenever the fetch path already has it, so the escalation
// never pays for a second browser navigation.
const cloudflareMarkdownRequest = Schema.Struct({
  html: Schema.optional(Schema.String),
  url: Schema.optional(Schema.String),
})

const cloudflareMarkdownRequestJson = Schema.fromJsonString(cloudflareMarkdownRequest)

const cloudflareMarkdownResponse = Schema.Struct({
  success: Schema.Boolean,
  result: Schema.optional(Schema.String),
  errors: Schema.optional(
    Schema.Array(
      Schema.Struct({
        code: Schema.Number,
        message: Schema.String,
      }),
    ),
  ),
})

const cloudflareMarkdownResponseJson = Schema.fromJsonString(cloudflareMarkdownResponse)

export class CloudflareMarkdownError extends Data.TaggedError(
  "CloudflareMarkdownError",
)<{
  readonly operation: string
  readonly url: string
  readonly cause: unknown
}> {}

/**
 * The escalation for pages local extraction cannot read. It returns Markdown
 * rather than a PageDocument, so it is not a PageFetcher tier: it sits beside
 * CloudflareBrowserFetcher and shares its credentials, not its contract.
 *
 * Unconfigured returns none, the same way CloudflareBrowserFetcher does, so an
 * install without Cloudflare credentials simply never escalates.
 */
export class CloudflareMarkdownExtractor extends Context.Service<CloudflareMarkdownExtractor>()(
  "@app/modules/content/CloudflareMarkdownExtractor",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig
      const accountId = config.fetch.cloudflareAccountId
      const apiToken = config.fetch.cloudflareApiToken

      const isConfigured = accountId.length > 0 && apiToken.length > 0

      return {
        extract: Effect.fn("CloudflareMarkdownExtractor.extract")(function* (input: {
          readonly url: string
          readonly html?: string
        }) {
          yield* Effect.annotateCurrentSpan("url", input.url)
          if (!isConfigured) {
            return Option.none<string>()
          }

          return yield* Effect.tryPromise({
            try: async () => {
              const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/markdown`

              const requestBody = Schema.encodeUnknownSync(
                cloudflareMarkdownRequestJson,
              )(input.html ? { html: input.html } : { url: input.url })

              const response = await globalThis.fetch(endpoint, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  authorization: `Bearer ${apiToken}`,
                },
                body: requestBody,
              })

              if (!response.ok) {
                const errorBody = await response.text().catch(() => "")
                throw new Error(
                  `Cloudflare API HTTP ${response.status}: ${errorBody.slice(0, 500)}`,
                )
              }

              const raw = await response.text()
              const decoded = Schema.decodeUnknownSync(cloudflareMarkdownResponseJson)(raw)

              if (!decoded.success) {
                const errorMessages = (decoded.errors ?? [])
                  .map((e) => `${e.code}: ${e.message}`)
                  .join("; ")
                throw new Error(errorMessages || "Cloudflare API returned success=false")
              }

              const markdown = decoded.result?.trim()
              if (!markdown || markdown.length > READABLE_MARKDOWN_MAX_CHARS) {
                return Option.none<string>()
              }

              return Option.some(markdown)
            },
            catch: (cause) =>
              new CloudflareMarkdownError({
                operation: "cloudflare-markdown",
                url: input.url,
                cause,
              }),
          })
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(
    CloudflareMarkdownExtractor,
    CloudflareMarkdownExtractor.make,
  )

  static readonly defaultLayer = CloudflareMarkdownExtractor.layer.pipe(
    Layer.provide(AppConfig.layer),
  )
}
