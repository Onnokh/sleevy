import { eq } from "drizzle-orm"
import { Context, Effect, Layer, Option, Schema } from "effect"

import {
  ReadableContent,
  type ReadableContentSource,
} from "../../domain/ReadableContent.js"
import type { LinkId } from "../../domain/SavedItem.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import { linkContentTable, linkEnrichmentTable } from "../persistence/schema.js"

const decodeReadableContent = Schema.decodeUnknownSync(ReadableContent)

export type StoredArticle = {
  readonly markdown: string
  readonly html: string
  readonly source: ReadableContentSource
}

export class LinkContentRepository extends Context.Service<LinkContentRepository>()(
  "@app/modules/content/LinkContentRepository",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      return {
        /**
         * Write a Link's Readable Content and raise its flag together. The flag
         * lives on link_enrichment so a list read never joins this table, and
         * writing both here is what keeps the two from disagreeing.
         */
        upsert: Effect.fn("LinkContentRepository.upsert")(function* (
          linkId: LinkId,
          article: StoredArticle,
        ) {
          const extractedAt = new Date()

          yield* db.transaction((tx) =>
            Effect.gen(function* () {
              yield* tx
                .insert(linkContentTable)
                .values({
                  linkId,
                  html: article.html,
                  markdown: article.markdown,
                  source: article.source,
                  extractedAt,
                })
                .onConflictDoUpdate({
                  target: linkContentTable.linkId,
                  set: {
                    html: article.html,
                    markdown: article.markdown,
                    source: article.source,
                    extractedAt,
                  },
                })

              yield* tx
                .update(linkEnrichmentTable)
                .set({ hasReadableContent: true })
                .where(eq(linkEnrichmentTable.linkId, linkId))
            }),
          )

          return extractedAt
        }),

        /**
         * Read the Markdown form. The column list is explicit and leaves out
         * the HTML, which is stored so a better conversion can run later and is
         * never served.
         */
        findByLinkId: Effect.fn("LinkContentRepository.findByLinkId")(function* (
          linkId: LinkId,
        ) {
          const [row] = yield* db
            .select({
              linkId: linkContentTable.linkId,
              markdown: linkContentTable.markdown,
              source: linkContentTable.source,
              extractedAt: linkContentTable.extractedAt,
            })
            .from(linkContentTable)
            .where(eq(linkContentTable.linkId, linkId))
            .limit(1)

          return row
            ? Option.some(decodeReadableContent(row))
            : Option.none<ReadableContent>()
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(LinkContentRepository, LinkContentRepository.make)

  static readonly defaultLayer = LinkContentRepository.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
  )
}
