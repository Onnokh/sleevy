import { Context, Effect, Layer, Schema } from "effect"

import type { LinkId, SavedItemId, UserId } from "../../domain/SavedItem.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import { normalizeSearchPhrase } from "./SearchPhrase.js"

export type SearchCandidate = {
  readonly savedItemId: SavedItemId
  readonly linkId: LinkId
  readonly ordinal: number
  readonly title: string | null
  readonly url: string
  readonly host: string
  readonly headingPath: string
  readonly content: string
  readonly score: number
}

export class HybridSearchRepositoryError extends Schema.TaggedErrorClass<HybridSearchRepositoryError>()(
  "HybridSearchRepositoryError",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

export class HybridSearchRepository extends Context.Service<HybridSearchRepository>()(
  "@app/modules/search/HybridSearchRepository",
  {
    make: Effect.gen(function* () {
      const { pool } = yield* PostgresClient

      return {
        keyword: Effect.fn("HybridSearchRepository.keyword")(function* (
          userId: UserId,
          query: string,
          limit: number,
        ) {
          const phrase = normalizeSearchPhrase(query)
          return yield* Effect.tryPromise({
            try: async () => {
              const result = await pool.query<SearchCandidate>(`
                select
                  si.id as "savedItemId",
                  p.link_id as "linkId",
                  p.ordinal,
                  m.title,
                  l.original_url as url,
                  l.host,
                  p.heading_path as "headingPath",
                  p.content,
                  ts_rank_cd(
                    setweight(to_tsvector('english', coalesce(m.title, '')), 'A') ||
                    setweight(to_tsvector('english', p.heading_path), 'B') || p.search,
                    websearch_to_tsquery('english', $2)
                  )::float8 as score
                from saved_items si
                join links l on l.id = si.link_id
                join link_content_passages p on p.link_id = l.id
                left join link_metadata m on m.link_id = l.id
                where si.user_id = $1
                  and (
                    p.search @@ websearch_to_tsquery('english', $2)
                    or to_tsvector('english', coalesce(m.title, '')) @@ websearch_to_tsquery('english', $2)
                    or to_tsvector('english', p.heading_path) @@ websearch_to_tsquery('english', $2)
                  )
                order by exists (
                  select 1 from unnest(array[m.title, p.heading_path, p.content]) as fields(text)
                  where position((' ' || $4 || ' ') in (' ' || trim(regexp_replace(
                    translate(lower(fields.text), chr(39) || '‘’', ''),
                    '[^[:alnum:]]+', ' ', 'g'
                  )) || ' ')) > 0
                ) desc, score desc, si.last_saved_at desc, p.ordinal asc
                limit $3
              `, [userId, query, limit, phrase.includes(" ") ? phrase : null])
              return result.rows
            },
            catch: (cause) => new HybridSearchRepositoryError({
              operation: "keyword",
              message: cause instanceof Error ? cause.message : String(cause),
            }),
          })
        }),

        semantic: Effect.fn("HybridSearchRepository.semantic")(function* (
          userId: UserId,
          embedding: readonly number[],
          model: string,
          limit: number,
        ) {
          return yield* Effect.tryPromise({
            try: async () => {
              const vector = `[${embedding.join(",")}]`
              const result = await pool.query<SearchCandidate>(`
                select
                  si.id as "savedItemId",
                  p.link_id as "linkId",
                  p.ordinal,
                  m.title,
                  l.original_url as url,
                  l.host,
                  p.heading_path as "headingPath",
                  p.content,
                  (1 - (p.embedding <=> $2::vector))::float8 as score
                from saved_items si
                join links l on l.id = si.link_id
                join link_content_passages p on p.link_id = l.id
                left join link_metadata m on m.link_id = l.id
                where si.user_id = $1 and p.embedding_model = $3
                order by p.embedding <=> $2::vector, si.last_saved_at desc
                limit $4
              `, [userId, vector, model, limit])
              return result.rows
            },
            catch: (cause) => new HybridSearchRepositoryError({
              operation: "semantic",
              message: cause instanceof Error ? cause.message : String(cause),
            }),
          })
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(HybridSearchRepository, HybridSearchRepository.make)
  static readonly defaultLayer = HybridSearchRepository.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
  )
}
