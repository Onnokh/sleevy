// Converts stored article HTML to Markdown again, in place.
//
// The HTML column exists so a better converter can reach Links already
// extracted without fetching their pages a second time — some of which are
// already gone. This is that job.
//
// It rewrites the Markdown only. The HTML is the input and is never touched,
// the gate is not re-run, and no page is fetched, so a Link that has Readable
// Content keeps it and a Link that has none is not considered.
//
// Usage, from apps/api:
//
//   bun scripts/reconvert-readable-content.ts            # dry run, writes nothing
//   bun scripts/reconvert-readable-content.ts --apply    # write the new Markdown
//
// The search index is a generated column, so Postgres rebuilds it from the new
// Markdown on write with nothing extra to run.

import { Effect } from "effect"
import { Pool } from "pg"

import { ReadableContentExtractor } from "../src/modules/content/ReadableContentExtractor.js"

const APPLY = process.argv.includes("--apply")
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

type Row = { link_id: string; host: string; html: string; markdown: string }

const main = Effect.gen(function* () {
  const extractor = yield* ReadableContentExtractor

  const rows: Row[] = yield* Effect.promise(async () => {
    const result = await pool.query<Row>(`
      select c.link_id, l.host, c.html, c.markdown
      from link_content c join links l on l.id = c.link_id
      order by l.host
    `)
    return result.rows
  })

  console.log(APPLY ? "=== APPLY: Markdown will be rewritten ===" : "=== DRY RUN: nothing is written ===")
  console.log(`stored articles: ${rows.length}\n`)

  let changed = 0
  let unchanged = 0
  let before = 0
  let after = 0
  const samples: string[] = []

  for (const row of rows) {
    const markdown = yield* extractor.convert(row.html)
    before += row.markdown.length
    after += markdown.length

    if (markdown === row.markdown) {
      unchanged++
      continue
    }

    changed++
    if (samples.length < 8) {
      const delta = markdown.length - row.markdown.length
      samples.push(`  ${row.host.padEnd(26)} ${delta > 0 ? "+" : ""}${delta} chars`)
    }

    if (APPLY) {
      yield* Effect.promise(() =>
        pool.query("update link_content set markdown = $2 where link_id = $1", [
          row.link_id,
          markdown,
        ]),
      )
    }
  }

  console.log(`  ${APPLY ? "rewritten" : "would rewrite"}  ${String(changed).padStart(4)}`)
  console.log(`  unchanged      ${String(unchanged).padStart(4)}`)
  console.log(`\n  markdown total ${before.toLocaleString()} -> ${after.toLocaleString()} chars`)
  if (samples.length > 0) console.log("\n=== SAMPLE CHANGES ===\n" + samples.join("\n"))
  if (!APPLY) console.log("\nNothing was written. Re-run with --apply.")
})

await Effect.runPromise(
  main.pipe(Effect.provide(ReadableContentExtractor.layer)),
).finally(() => pool.end())
