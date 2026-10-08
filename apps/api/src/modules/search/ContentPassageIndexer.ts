import { Context, Effect, Layer } from "effect"

import type { LinkId } from "../../domain/SavedItem.js"
import { splitReadableContent, passageEmbeddingInput } from "./ContentPassage.js"
import { ContentPassageRepository } from "./ContentPassageRepository.js"
import { EmbeddingProvider } from "./EmbeddingProvider.js"

export class ContentPassageIndexer extends Context.Service<ContentPassageIndexer>()(
  "@app/modules/search/ContentPassageIndexer",
  {
    make: Effect.gen(function* () {
      const embeddings = yield* EmbeddingProvider
      const repository = yield* ContentPassageRepository

      return {
        enabled: embeddings.enabled,
        index: Effect.fn("ContentPassageIndexer.index")(function* (input: {
          readonly linkId: LinkId
          readonly title: string | undefined
          readonly markdown: string
        }) {
          if (!embeddings.enabled) return 0

          const passages = splitReadableContent(input.markdown)
          const embedded = []
          for (const passage of passages) {
            const embedding = yield* embeddings.embedPassage(
              passageEmbeddingInput(input.title, passage),
            )
            embedded.push({ ...passage, embedding })
          }

          yield* repository.replace(input.linkId, embeddings.model, embedded)
          return embedded.length
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(ContentPassageIndexer, ContentPassageIndexer.make)
  static readonly defaultLayer = ContentPassageIndexer.layer.pipe(
    Layer.provide(EmbeddingProvider.defaultLayer),
    Layer.provide(ContentPassageRepository.defaultLayer),
  )
}
