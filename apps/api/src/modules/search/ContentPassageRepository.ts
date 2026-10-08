import { and, asc, eq, isNull, ne } from "drizzle-orm"
import { Context, Effect, Layer, Option } from "effect"

import type { LinkId } from "../../domain/SavedItem.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import {
  linkContentPassagesTable,
  linkContentTable,
  linkEnrichmentTable,
  linkMetadataTable,
  linksTable,
} from "../persistence/schema.js"
import type { ContentPassage } from "./ContentPassage.js"

export type PendingReadableContent = {
  readonly linkId: LinkId
  readonly title: string | undefined
  readonly markdown: string
}

export type EmbeddedContentPassage = ContentPassage & {
  readonly embedding: readonly number[]
}

export class ContentPassageRepository extends Context.Service<ContentPassageRepository>()(
  "@app/modules/search/ContentPassageRepository",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      return {
        findNextPending: Effect.fn("ContentPassageRepository.findNextPending")(function* () {
          const [row] = yield* db
            .select({
              linkId: linkContentTable.linkId,
              title: linkMetadataTable.title,
              markdown: linkContentTable.markdown,
            })
            .from(linkContentTable)
            .innerJoin(linksTable, eq(linkContentTable.linkId, linksTable.id))
            .innerJoin(linkEnrichmentTable, eq(linkEnrichmentTable.linkId, linksTable.id))
            .leftJoin(linkMetadataTable, eq(linkMetadataTable.linkId, linksTable.id))
            .where(and(
              isNull(linkContentTable.passageIndexedAt),
              isNull(linkContentTable.passageIndexError),
              ne(linkEnrichmentTable.status, "pending"),
            ))
            .orderBy(asc(linkContentTable.extractedAt))
            .limit(1)

          return row
            ? Option.some({
              linkId: row.linkId,
              title: row.title ?? undefined,
              markdown: row.markdown,
            })
            : Option.none<PendingReadableContent>()
        }),

        replace: Effect.fn("ContentPassageRepository.replace")(function* (
          linkId: LinkId,
          model: string,
          passages: readonly EmbeddedContentPassage[],
        ) {
          const indexedAt = new Date()
          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .delete(linkContentPassagesTable)
                .where(eq(linkContentPassagesTable.linkId, linkId))

              if (passages.length > 0) {
                yield* tx.insert(linkContentPassagesTable).values(
                  passages.map((passage) => ({
                    linkId,
                    ordinal: passage.ordinal,
                    headingPath: passage.headingPath,
                    content: passage.content,
                    embedding: [...passage.embedding],
                    embeddingModel: model,
                    indexedAt,
                  })),
                )
              }

              yield* tx
                .update(linkContentTable)
                .set({ passageIndexedAt: indexedAt, passageIndexError: null })
                .where(eq(linkContentTable.linkId, linkId))
            }),
          )
        }),

        markFailed: Effect.fn("ContentPassageRepository.markFailed")(function* (
          linkId: LinkId,
          message: string,
        ) {
          yield* db
            .update(linkContentTable)
            .set({ passageIndexError: message.slice(0, 1_000) })
            .where(eq(linkContentTable.linkId, linkId))
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(ContentPassageRepository, ContentPassageRepository.make)
  static readonly defaultLayer = ContentPassageRepository.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
  )
}
