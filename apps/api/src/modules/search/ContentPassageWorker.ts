import { Context, Effect, Layer, Option, Result } from "effect"

import { ContentPassageIndexer } from "./ContentPassageIndexer.js"
import { ContentPassageRepository } from "./ContentPassageRepository.js"

const IDLE_DELAY = "10 seconds"

export class ContentPassageWorker extends Context.Service<ContentPassageWorker>()(
  "@app/modules/search/ContentPassageWorker",
  {
    make: Effect.gen(function* () {
      const indexer = yield* ContentPassageIndexer
      const repository = yield* ContentPassageRepository

      const runOnce = Effect.fn("ContentPassageWorker.runOnce")(function* () {
        if (!indexer.enabled) return false
        const next = yield* repository.findNextPending()
        if (Option.isNone(next)) return false

        const result = yield* Effect.result(indexer.index(next.value))
        if (Result.isFailure(result)) {
          const message = renderError(result.failure)
          yield* repository.markFailed(next.value.linkId, message)
          yield* Effect.logWarning("content passage indexing failed", {
            linkId: next.value.linkId,
            message,
          })
        } else {
          yield* Effect.logInfo("content passages indexed", {
            linkId: next.value.linkId,
            passageCount: result.success,
          })
        }
        return true
      })

      if (indexer.enabled) {
        yield* Effect.forkScoped(
          Effect.forever(
            runOnce().pipe(
              Effect.flatMap((worked) => worked ? Effect.void : Effect.sleep(IDLE_DELAY)),
              Effect.catchCause((cause) =>
                Effect.logError("content passage worker failed", { cause }).pipe(
                  Effect.andThen(Effect.sleep(IDLE_DELAY)),
                ),
              ),
            ),
          ),
        )
      }

      return { runOnce }
    }),
  },
) {
  static readonly layer = Layer.effect(ContentPassageWorker, ContentPassageWorker.make)
  static readonly defaultLayer = ContentPassageWorker.layer.pipe(
    Layer.provide(ContentPassageIndexer.defaultLayer),
    Layer.provide(ContentPassageRepository.defaultLayer),
  )
}

const renderError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
