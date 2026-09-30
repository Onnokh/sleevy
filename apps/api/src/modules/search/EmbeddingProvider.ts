import { Context, Effect, Layer, Schema } from "effect"

import { AppConfig } from "../../runtime/Config.js"

export class EmbeddingError extends Schema.TaggedErrorClass<EmbeddingError>()(
  "EmbeddingError",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

const OllamaEmbedResponse = Schema.Struct({
  embeddings: Schema.Array(Schema.Array(Schema.Number)),
})

const OllamaEmbedRequestJson = Schema.fromJsonString(Schema.Struct({
  model: Schema.String,
  input: Schema.Array(Schema.String),
  options: Schema.Struct({ num_batch: Schema.Number, num_ctx: Schema.Number }),
}))
const OllamaEmbedResponseJson = Schema.fromJsonString(OllamaEmbedResponse)
const encodeRequest = Schema.encodeUnknownSync(OllamaEmbedRequestJson)
const decodeResponse = Schema.decodeUnknownEffect(OllamaEmbedResponseJson)

export class EmbeddingProvider extends Context.Service<EmbeddingProvider>()(
  "@app/modules/search/EmbeddingProvider",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig
      const search = config.search

      const embed = Effect.fn("EmbeddingProvider.embed")(function* (
        input: string,
        operation: "passage" | "query",
      ) {
        if (!search.semanticEnabled) {
          return yield* new EmbeddingError({
            operation,
            message: "Semantic search is disabled",
          })
        }

        const text = operation === "query"
          ? `Instruct: Given a question about saved reading material, retrieve passages that answer it.\nQuery: ${input}`
          : input

        const body = yield* Effect.tryPromise({
          try: async () => {
            const response = await fetch(`${search.embeddingBaseUrl.replace(/\/$/, "")}/api/embed`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              // Ollama's default batch exceeds our CPU service's memory budget.
              body: encodeRequest({
                model: search.embeddingModel,
                input: [text],
                options: { num_batch: 512, num_ctx: 1024 },
              }),
              signal: AbortSignal.timeout(operation === "passage"
                ? Math.max(search.embeddingTimeoutMs, 60_000)
                : search.embeddingTimeoutMs),
            })
            if (!response.ok) throw new Error(`Ollama answered HTTP ${response.status}`)
            return response.text()
          },
          catch: (cause) => new EmbeddingError({ operation, message: renderError(cause) }),
        })

        const decoded = yield* decodeResponse(body).pipe(
          Effect.mapError((cause) =>
            new EmbeddingError({ operation, message: `Invalid Ollama response: ${renderError(cause)}` }),
          ),
        )
        const embedding = decoded.embeddings[0]
        if (!embedding || embedding.length !== search.embeddingDimensions) {
          return yield* new EmbeddingError({
            operation,
            message: `Expected ${search.embeddingDimensions} dimensions, received ${embedding?.length ?? 0}`,
          })
        }
        return embedding
      })

      return {
        enabled: search.semanticEnabled,
        model: search.embeddingModel,
        dimensions: search.embeddingDimensions,
        embedPassage: (input: string) => embed(input, "passage"),
        embedQuery: (input: string) => embed(input, "query"),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(EmbeddingProvider, EmbeddingProvider.make)
  static readonly defaultLayer = EmbeddingProvider.layer.pipe(Layer.provide(AppConfig.layer))
}

const renderError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
