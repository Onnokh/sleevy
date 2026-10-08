import { beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Pool } from "pg"

import type { UserId } from "../../src/domain/SavedItem.js"
import { HybridSearchRepository } from "../../src/modules/search/HybridSearchRepository.js"
import {
  cleanTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
  withTestDatabaseUrl,
} from "../lib/postgres.js"

beforeAll(setupTestDatabase)
beforeEach(cleanTestDatabase)

const seedPassage = async (input: {
  readonly userId: string
  readonly linkId: string
  readonly savedItemId: string
  readonly content: string
  readonly embedding: readonly number[]
}) => {
  const pool = new Pool({ connectionString: testDatabaseUrl })
  try {
    await pool.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, $1, $2, true, now(), now()) on conflict (id) do nothing`,
      [input.userId, `${input.userId}@example.com`],
    )
    await pool.query(
      `insert into links (id, original_url, normalized_url, host)
       values ($1, $2, $2, 'example.com')`,
      [input.linkId, `https://example.com/${input.linkId}`],
    )
    await pool.query(
      `insert into link_metadata (link_id, title) values ($1, $2)`,
      [input.linkId, `Title ${input.linkId}`],
    )
    await pool.query(
      `insert into link_enrichment (link_id, status) values ($1, 'enriched')`,
      [input.linkId],
    )
    await pool.query(
      `insert into saved_items (id, user_id, link_id) values ($1, $2, $3)`,
      [input.savedItemId, input.userId, input.linkId],
    )
    await pool.query(
      `insert into link_content (link_id, html, markdown, passage_indexed_at)
       values ($1, '<p>content</p>', $2, now())`,
      [input.linkId, input.content],
    )
    await pool.query(
      `insert into link_content_passages
         (link_id, ordinal, heading_path, content, embedding, embedding_model)
       values ($1, 0, 'Operations', $2, $3::vector, 'qwen3-embedding:0.6b')`,
      [input.linkId, input.content, `[${input.embedding.join(",")}]`],
    )
  } finally {
    await pool.end()
  }
}

describe("hybrid search integration flow", () => {
  test("keeps a phrase match ahead of repeated loose terms when candidates are limited", async () => {
    const embedding = [1, ...Array<number>(1023).fill(0)]
    await seedPassage({
      userId: "search-user-a",
      linkId: "search-loose",
      savedItemId: "search-saved-loose",
      content: "Parse input and validate output. ".repeat(30),
      embedding,
    })
    await seedPassage({
      userId: "search-user-a",
      linkId: "search-exact",
      savedItemId: "search-saved-exact",
      content: "Read [Parse, Don't Validate](https://example.com/guide).",
      embedding,
    })

    await withTestDatabaseUrl(() => Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* HybridSearchRepository
        const results = yield* repository.keyword("search-user-a" as UserId, "Parse, Don’t Validate", 1)
        expect(results.map((result) => String(result.linkId))).toEqual(["search-exact"])
      }).pipe(Effect.provide(HybridSearchRepository.defaultLayer)),
    ))
  })

  test("scopes keyword and semantic candidates through the Account's Saved Items", async () => {
    const firstVector = [1, ...Array<number>(1023).fill(0)]
    const secondVector = [0, 1, ...Array<number>(1022).fill(0)]
    await seedPassage({
      userId: "search-user-a",
      linkId: "search-link-a",
      savedItemId: "search-saved-a",
      content: "A quorum prevents split-brain writes during failover.",
      embedding: firstVector,
    })
    await seedPassage({
      userId: "search-user-b",
      linkId: "search-link-b",
      savedItemId: "search-saved-b",
      content: "A garden needs regular watering.",
      embedding: secondVector,
    })

    await withTestDatabaseUrl(() =>
      Effect.runPromise(
        Effect.gen(function* () {
          const repository = yield* HybridSearchRepository
          const userA = "search-user-a" as UserId
          const userB = "search-user-b" as UserId

          const ownKeyword = yield* repository.keyword(userA, "quorum", 10)
          const otherKeyword = yield* repository.keyword(userB, "quorum", 10)
          expect(ownKeyword.map((result) => String(result.linkId))).toEqual(["search-link-a"])
          expect(otherKeyword).toEqual([])

          // User B's semantic query points exactly at A's passage. The query
          // still returns only B's own, less similar passage.
          const scopedSemantic = yield* repository.semantic(
            userB,
            firstVector,
            "qwen3-embedding:0.6b",
            10,
          )
          expect(scopedSemantic.map((result) => String(result.linkId))).toEqual(["search-link-b"])
        }).pipe(Effect.provide(HybridSearchRepository.defaultLayer)),
      ),
    )
  })
})
