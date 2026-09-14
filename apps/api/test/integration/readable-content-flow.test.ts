import { beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Effect, Layer, Option } from "effect"
import { Pool } from "pg"

import type { UserId } from "../../src/domain/SavedItem.js"
import { savedItemToDto } from "../../src/api/ApiContract.js"
import { CaptureService } from "../../src/modules/capture/CaptureService.js"
import { LinkContentRepository } from "../../src/modules/content/LinkContentRepository.js"
import { SavedItemRepository } from "../../src/modules/saved-items/SavedItemRepository.js"
import {
  cleanTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
  withTestDatabaseUrl,
} from "../lib/postgres.js"

const persistenceLayer = Layer.mergeAll(
  CaptureService.defaultLayer,
  SavedItemRepository.defaultLayer,
  LinkContentRepository.defaultLayer,
)

const runIntegration = <A, E>(
  effect: Effect.Effect<A, E, CaptureService | SavedItemRepository | LinkContentRepository>,
) =>
  withTestDatabaseUrl(() =>
    Effect.runPromise(effect.pipe(Effect.provide(persistenceLayer))),
  )

const insertUser = async (userId: UserId) => {
  const pool = new Pool({ connectionString: testDatabaseUrl })
  try {
    await pool.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, $2, $3, true, now(), now())`,
      [userId, "Readable Content User", `${userId}@example.com`],
    )
  } finally {
    await pool.end()
  }
}

const query = async <T,>(sql: string, params: unknown[]): Promise<T[]> => {
  const pool = new Pool({ connectionString: testDatabaseUrl })
  try {
    const result = await pool.query(sql, params)
    return result.rows as T[]
  } finally {
    await pool.end()
  }
}

beforeAll(async () => {
  await setupTestDatabase()
})

beforeEach(async () => {
  await cleanTestDatabase()
})

const markdown = [
  "## Monomorphic call sites",
  "",
  "Keeping one object shape per call site lets the engine inline the property",
  "lookup instead of walking a megamorphic cache. See [the notes](https://v8.dev/blog/ic).",
].join("\n")

describe("readable content integration flow", () => {
  test("stores both forms, raises the flag, and serves only the Markdown", async () => {
    const runId = randomUUID()
    const userId = `readable-user-${runId}` as UserId
    await insertUser(userId)

    await runIntegration(
      Effect.gen(function* () {
        const capture = yield* CaptureService
        const repo = yield* SavedItemRepository
        const content = yield* LinkContentRepository

        const created = yield* capture.save({
          userId,
          url: `https://example.com/articles/readable-${runId}`,
          captureChannel: "api",
        })
        const linkId = created.savedItem.link.id
        const savedItemId = created.savedItem.savedItem.id

        // Before extraction there is no Reader View, and the flag says so.
        const before = yield* repo.findByUserAndId(userId, savedItemId)
        expect(Option.isSome(before)).toBe(true)
        if (Option.isNone(before)) return
        expect(before.value.enrichment.hasReadableContent).toBe(false)
        expect(savedItemToDto(before.value).hasReadableContent).toBe(false)

        yield* content.upsert(linkId, {
          html: "<div><h2>Monomorphic call sites</h2><p>…</p></div>",
          markdown,
          source: "readability",
        })

        // The row and the flag are written together, so a list read can answer
        // "is there a Reader View" without joining link_content.
        const after = yield* repo.findByUserAndId(userId, savedItemId)
        expect(Option.isSome(after)).toBe(true)
        if (Option.isNone(after)) return
        expect(after.value.enrichment.hasReadableContent).toBe(true)
        expect(savedItemToDto(after.value).hasReadableContent).toBe(true)

        // The read is Markdown-only. The article HTML is stored so a better
        // conversion can run later, and is never handed out.
        const stored = yield* content.findByLinkId(linkId)
        expect(Option.isSome(stored)).toBe(true)
        if (Option.isNone(stored)) return
        expect(stored.value.markdown).toContain("Monomorphic call sites")
        expect(stored.value.source).toBe("readability")
        expect(Object.keys(stored.value)).not.toContain("html")

        // Re-extraction replaces the row rather than adding one.
        yield* content.upsert(linkId, {
          html: "<div><p>second pass</p></div>",
          markdown: "Second pass.",
          source: "readability",
        })
        const rows = yield* Effect.promise(() =>
          query<{ count: string }>(
            "select count(*)::text as count from link_content where link_id = $1",
            [linkId],
          ),
        )
        expect(rows[0]?.count).toBe("1")
      }),
    )
  })

  test("indexes the prose and leaves link targets out of it", async () => {
    const runId = randomUUID()
    const userId = `readable-index-${runId}` as UserId
    await insertUser(userId)

    await runIntegration(
      Effect.gen(function* () {
        const capture = yield* CaptureService
        const content = yield* LinkContentRepository

        const created = yield* capture.save({
          userId,
          url: `https://example.com/articles/indexed-${runId}`,
          captureChannel: "api",
        })
        yield* content.upsert(created.savedItem.link.id, {
          html: "<div><p>…</p></div>",
          markdown,
          source: "readability",
        })

        const lexemes = yield* Effect.promise(() =>
          query<{ terms: string[] }>(
            "select tsvector_to_array(search) as terms from link_content where link_id = $1",
            [created.savedItem.link.id],
          ),
        )
        const terms = lexemes[0]?.terms ?? []

        // Prose is indexed, including the text of a link.
        expect(terms).toContain("monomorph")
        expect(terms).toContain("note")
        // The link target is not, or a search for "blog" would match every page
        // that happens to link to one.
        expect(terms.some((term) => term.includes("v8.dev"))).toBe(false)
        expect(terms.some((term) => term.includes("/blog/"))).toBe(false)
      }),
    )
  })

  test("drops the Readable Content when its Link goes", async () => {
    const runId = randomUUID()
    const userId = `readable-cascade-${runId}` as UserId
    await insertUser(userId)

    await runIntegration(
      Effect.gen(function* () {
        const capture = yield* CaptureService
        const content = yield* LinkContentRepository

        const created = yield* capture.save({
          userId,
          url: `https://example.com/articles/cascade-${runId}`,
          captureChannel: "api",
        })
        const linkId = created.savedItem.link.id
        yield* content.upsert(linkId, {
          html: "<div><p>…</p></div>",
          markdown,
          source: "readability",
        })

        yield* Effect.promise(() => query("delete from links where id = $1", [linkId]))

        const rows = yield* Effect.promise(() =>
          query<{ count: string }>(
            "select count(*)::text as count from link_content where link_id = $1",
            [linkId],
          ),
        )
        expect(rows[0]?.count).toBe("0")
      }),
    )
  })
})
