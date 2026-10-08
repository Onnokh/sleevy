// Build the derived Content Passage index for stored Readable Content.
//
// Usage, from apps/api:
//   bun --env-file=.env scripts/backfill-content-passages.ts
//   bun --env-file=.env scripts/backfill-content-passages.ts --apply
//   bun --env-file=.env scripts/backfill-content-passages.ts --apply --retry-failed
//   bun --env-file=.env scripts/backfill-content-passages.ts --apply --rebuild

import { Effect, Layer, Option, Result } from "effect"
import { Pool } from "pg"

import { ContentPassageIndexer } from "../src/modules/search/ContentPassageIndexer.js"
import { ContentPassageRepository } from "../src/modules/search/ContentPassageRepository.js"

const APPLY = process.argv.includes("--apply")
const RETRY_FAILED = process.argv.includes("--retry-failed")
const REBUILD = process.argv.includes("--rebuild")
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error("DATABASE_URL is not set.")

const pool = new Pool({ connectionString: databaseUrl })
const countResult = await pool.query<{ count: number }>(`
  select count(*)::int as count
  from link_content
  where ($1::boolean or passage_indexed_at is null)
    and ($2::boolean or passage_index_error is null)
`, [REBUILD, RETRY_FAILED])
const pending = countResult.rows[0]?.count ?? 0

if (!APPLY) {
  console.log(`DRY RUN: ${pending} Readable Content row(s) need passage indexing.`)
  console.log("Nothing was written. Re-run with --apply.")
  await pool.end()
  process.exit(0)
}

if (process.env.SEMANTIC_SEARCH_ENABLED !== "true") {
  throw new Error("Set SEMANTIC_SEARCH_ENABLED=true before applying the backfill.")
}

if (REBUILD) {
  await pool.query(`
    update link_content
    set passage_indexed_at = null, passage_index_error = null
  `)
} else if (RETRY_FAILED) {
  await pool.query(`
    update link_content
    set passage_index_error = null
    where passage_indexed_at is null
  `)
}
await pool.end()

const layer = Layer.merge(
  ContentPassageIndexer.defaultLayer,
  ContentPassageRepository.defaultLayer,
)

const program = Effect.gen(function* () {
  const indexer = yield* ContentPassageIndexer
  const repository = yield* ContentPassageRepository
  let indexed = 0
  let failed = 0

  while (true) {
    const next = yield* repository.findNextPending()
    if (Option.isNone(next)) break

    const result = yield* Effect.result(indexer.index(next.value))
    if (Result.isFailure(result)) {
      failed++
      const message = result.failure instanceof Error
        ? result.failure.message
        : String(result.failure)
      yield* repository.markFailed(next.value.linkId, message)
      console.error(`failed ${next.value.linkId}: ${message}`)
    } else {
      indexed++
      console.log(`indexed ${next.value.linkId}: ${result.success} passage(s)`)
    }
  }

  console.log(`done: ${indexed} indexed, ${failed} failed`)
})

await Effect.runPromise(program.pipe(Effect.provide(layer)))
