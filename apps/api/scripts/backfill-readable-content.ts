// Gives an already-captured Link its Readable Content.
//
// Enrichment writes Readable Content, but `enrich` returns early for a Link
// whose status is already `enriched` — which is every Link saved before this
// existed. Without this backfill the Reader View would be empty for an entire
// existing Library and stay that way, because nothing ever re-enriches a Link.
//
// It also answers the question the ADR left open: how much of a real Library
// yields an article at all. That rate depends on where it is measured from. A
// laptop on a residential address reaches pages a Hetzner origin is refused, so
// a rate measured locally is optimistic by an unknown margin. Run the dry pass
// on the production host before trusting a number.
//
// Usage, from apps/api:
//
//   bun scripts/backfill-readable-content.ts            # dry run, writes nothing
//   bun scripts/backfill-readable-content.ts --apply    # write the rows
//
// Deliberately narrow, because this runs against real Libraries:
//
//   * Only `link_content` and the `has_readable_content` flag are written, both
//     by the same repository call the Enrichment stage uses, in one transaction.
//   * Link Enrichment is not re-run and no Enrichment Job is recorded, so no AI
//     call is paid for, and no Tags, Preview Summary, or Link Metadata are
//     rewritten. Extraction is the only work Readable Content needs.
//   * The gate decides, exactly as it does during Enrichment. A page it rejects
//     stores nothing at all rather than a fragment.
//   * A Link that already has Readable Content is skipped, never re-fetched.
//
// Re-running is safe and is the way to pick up Links a fetch missed: each run
// only considers Links that still have no row, so a run resumes where the last
// one stopped.

import { Effect, Layer, Option, Result } from "effect"
import { Pool } from "pg"

import type { LinkId } from "../src/domain/SavedItem.js"
import { LinkContentRepository } from "../src/modules/content/LinkContentRepository.js"
import { ReadableContentExtractor } from "../src/modules/content/ReadableContentExtractor.js"
import { PageFetcher } from "../src/modules/fetch/PageFetcher.js"

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(process.env.LIMIT ?? 0)
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4)

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

type Row = { id: string; original_url: string; host: string; type: string }

type Outcome =
  | { kind: "extracted"; row: Row; chars: number }
  | { kind: "no-article"; row: Row }
  | { kind: "not-html"; row: Row }
  | { kind: "unreachable"; row: Row; detail: string }

const pool = new Pool({ connectionString: DATABASE_URL })

const layer = Layer.mergeAll(
  PageFetcher.defaultLayer,
  ReadableContentExtractor.layer,
  LinkContentRepository.defaultLayer,
)

const main = Effect.gen(function* () {
  const fetcher = yield* PageFetcher
  const extractor = yield* ReadableContentExtractor
  const repository = yield* LinkContentRepository

  const rows: Row[] = yield* Effect.promise(async () => {
    const result = await pool.query<Row>(`
      select l.id, l.original_url, l.host, e.type
      from links l
      join link_enrichment e on e.link_id = l.id
      where exists (select 1 from saved_items s where s.link_id = l.id)
        and not exists (select 1 from link_content c where c.link_id = l.id)
      order by l.created_at desc
      ${LIMIT > 0 ? `limit ${LIMIT}` : ""}
    `)
    return result.rows
  })

  console.log(APPLY ? "=== APPLY: rows will be written ===" : "=== DRY RUN: nothing is written ===")
  console.log(`Links with a Saved Item and no Readable Content: ${rows.length}\n`)

  let done = 0
  const outcomes = yield* Effect.forEach(
    rows,
    (row) =>
      Effect.gen(function* () {
        // The real fetch path, so a Link this host is refused by still reaches
        // the Cloudflare tier rather than being counted as a loss.
        const fetched = yield* Effect.all([fetcher.fetch(row.original_url)], {
          mode: "result",
        }).pipe(Effect.map(([result]) => result))

        if (Result.isFailure(fetched)) {
          return {
            kind: "unreachable",
            row,
            detail: String((fetched.failure as { cause?: unknown }).cause ?? fetched.failure).slice(0, 70),
          } as Outcome
        }
        if (Option.isNone(fetched.success)) {
          return { kind: "not-html", row } as Outcome
        }

        const page = fetched.success.value
        const url = page.finalUrl

        if (!(yield* extractor.isReadable(page.html, url))) {
          return { kind: "no-article", row } as Outcome
        }
        const article = yield* extractor.extract(page.html, url)
        if (Option.isNone(article)) {
          return { kind: "no-article", row } as Outcome
        }

        if (APPLY) {
          yield* repository.upsert(row.id as LinkId, article.value)
        }

        return {
          kind: "extracted",
          row,
          chars: article.value.markdown.length,
        } as Outcome
      }).pipe(
        (effect) =>
          Effect.all([effect], { mode: "result" }).pipe(
            Effect.map(([result]) =>
              Result.isSuccess(result)
                ? result.success
                : ({ kind: "unreachable", row, detail: String(result.failure).slice(0, 70) } as Outcome),
            ),
          ),
        Effect.tap(() =>
          Effect.sync(() => {
            if (++done % 25 === 0) console.error(`  … ${done}/${rows.length}`)
          }),
        ),
      ),
    { concurrency: CONCURRENCY },
  )

  const of = (kind: Outcome["kind"]) => outcomes.filter((o) => o.kind === kind)
  const extracted = of("extracted") as Array<Extract<Outcome, { kind: "extracted" }>>

  console.log("=== OUTCOME ===")
  for (const kind of ["extracted", "no-article", "not-html", "unreachable"] as const) {
    console.log(`  ${kind.padEnd(14)} ${String(of(kind).length).padStart(5)}`)
  }

  if (extracted.length > 0) {
    const chars = extracted.map((o) => o.chars).sort((a, b) => a - b)
    console.log(
      `\n  ${APPLY ? "WROTE" : "WOULD WRITE"}: ${extracted.length} of ${rows.length} (${Math.round((extracted.length / rows.length) * 100)}%)`,
    )
    console.log(`  markdown total  ${chars.reduce((a, b) => a + b, 0).toLocaleString()} chars`)
    console.log(`  markdown median ${chars[Math.floor(chars.length / 2)]?.toLocaleString()} chars`)
  }

  // Named because this is the number that differs by origin, and a rerun after
  // fixing one host is cheap.
  const unreachable = of("unreachable") as Array<Extract<Outcome, { kind: "unreachable" }>>
  if (unreachable.length > 0) {
    const byHost = new Map<string, number>()
    for (const o of unreachable) byHost.set(o.row.host, (byHost.get(o.row.host) ?? 0) + 1)
    console.log("\n=== UNREACHABLE, BY HOST ===")
    for (const [host, n] of [...byHost].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`  ${String(n).padStart(3)}  ${host}`)
    }
  }

  if (!APPLY) {
    console.log("\nNothing was written. Re-run with --apply to write these rows.")
  }
})

await Effect.runPromise(main.pipe(Effect.provide(layer))).finally(() => pool.end())
