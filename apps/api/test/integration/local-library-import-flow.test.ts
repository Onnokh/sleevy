import { beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Effect, Exit, Layer } from "effect"
import { Pool } from "pg"

import type { UserId } from "../../src/domain/SavedItem.js"
import { CaptureService } from "../../src/modules/capture/CaptureService.js"
import {
  LocalLibraryImport,
  type LocalLibraryItem,
} from "../../src/modules/local-library/LocalLibraryImport.js"
import {
  cleanTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
  withTestDatabaseUrl,
} from "../lib/postgres.js"

const persistenceLayer = Layer.mergeAll(
  CaptureService.defaultLayer,
  LocalLibraryImport.defaultLayer,
)

const runIntegration = <A, E>(
  effect: Effect.Effect<A, E, CaptureService | LocalLibraryImport>,
) =>
  withTestDatabaseUrl(() =>
    Effect.runPromise(effect.pipe(Effect.provide(persistenceLayer))),
  )

const withPool = async <A>(run: (pool: Pool) => Promise<A>) => {
  const pool = new Pool({ connectionString: testDatabaseUrl })
  try {
    return await run(pool)
  } finally {
    await pool.end()
  }
}

const newUser = async () => {
  const userId = `integration-user-${randomUUID()}` as UserId
  await withPool((pool) =>
    pool.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, 'Integration User', $2, true, now(), now())`,
      [userId, `${userId}@example.com`],
    ))
  return userId
}

const count = (table: string, where = "true", params: unknown[] = []) =>
  withPool(async (pool) => {
    const result = await pool.query<{ count: string }>(`select count(*) from ${table} where ${where}`, params)
    return Number(result.rows[0]?.count ?? 0)
  })

const item = (overrides: Partial<LocalLibraryItem> & { readonly url: string }): LocalLibraryItem => ({
  title: null,
  description: null,
  siteName: null,
  faviconUrl: null,
  previewSummary: null,
  tags: [],
  isRead: false,
  savedAt: new Date("2026-10-01T08:00:00.000Z"),
  folderName: null,
  ...overrides,
})

const importLibrary = (userId: UserId, library: Parameters<LocalLibraryImport["Service"]["import"]>[1]) =>
  runIntegration(Effect.gen(function* () {
    const localLibrary = yield* LocalLibraryImport
    return yield* localLibrary.import(userId, library)
  }))

beforeAll(async () => {
  await setupTestDatabase()
})

beforeEach(async () => {
  await cleanTestDatabase()
})

describe("local library import integration flow", () => {
  test("keeps what the device enriched, files into new Folders, and answers in request order", async () => {
    const userId = await newUser()
    const savedAt = new Date("2026-09-14T10:30:00.000Z")

    const imported = await importLibrary(userId, {
      folders: [{ name: "Reading", emoji: "📚", color: "blue" }],
      items: [
        item({
          url: "https://example.com/blog/effect?b=2&a=1#top",
          title: "Effect in practice",
          description: "A long read about Effect.",
          siteName: "Example",
          faviconUrl: "https://example.com/favicon.ico",
          previewSummary: "How one team moved to Effect.",
          tags: ["TypeScript", "backend", "cooking", "typescript"],
          isRead: true,
          savedAt,
          folderName: "reading",
        }),
        item({ url: "https://example.org/plain" }),
      ],
    })

    expect(imported.map((saved) => saved.link.normalizedUrl)).toEqual([
      "https://example.com/blog/effect?a=1&b=2",
      "https://example.org/plain",
    ])

    const [first, second] = imported
    expect(first!.metadata.title).toBe("Effect in practice")
    expect(first!.metadata.description).toBe("A long read about Effect.")
    expect(first!.metadata.siteName).toBe("Example")
    expect(first!.metadata.faviconUrl).toBe("https://example.com/favicon.ico")
    expect(first!.enrichment.previewSummary).toBe("How one team moved to Effect.")
    // Unknown Tags are dropped, known ones keep the closed vocabulary's form.
    expect(first!.enrichment.tags).toEqual(["typescript", "backend"])
    expect(first!.enrichment.status).toBe("enriched")
    expect(first!.enrichment.type).toBe("article")
    expect(first!.savedItem.captureChannel).toBe("ios-app")
    expect(first!.savedItem.isRead).toBe(true)
    expect(first!.savedItem.createdAt.toISOString()).toBe(savedAt.toISOString())
    expect(first!.savedItem.lastSavedAt.toISOString()).toBe(savedAt.toISOString())
    expect(first!.folder?.name).toBe("Reading")
    expect(first!.folder?.emoji).toBe("📚")
    expect(first!.folder?.color).toBe("blue")

    // Enrichment Status has no "finished without a summary".
    expect(second!.enrichment.status).toBe("enriched")
    expect(second!.metadata.title).toBeUndefined()
    expect(second!.folder).toBeUndefined()
  })

  test("starts no Enrichment Job for an imported item", async () => {
    const userId = await newUser()

    await importLibrary(userId, {
      folders: [],
      items: [item({ url: "https://example.com/one" }), item({ url: "https://example.com/two" })],
    })

    expect(await count("enrichment_jobs")).toBe(0)
    expect(await count("link_content")).toBe(0)
  })

  test("keeps the server's Saved Item for a Normalized URL the Account already has", async () => {
    const userId = await newUser()
    const savedAt = new Date("2026-01-01T00:00:00.000Z")

    const captured = await runIntegration(Effect.gen(function* () {
      const capture = yield* CaptureService
      return yield* capture.save({ userId, url: "https://example.com/known?a=1&b=2", captureChannel: "chrome-extension" })
    }))

    const [imported] = await importLibrary(userId, {
      folders: [{ name: "Later", emoji: null, color: null }],
      items: [item({
        url: "https://EXAMPLE.com:443/known?b=2&a=1#section",
        title: "Device title",
        previewSummary: "Device summary",
        tags: ["ai"],
        isRead: true,
        savedAt,
        folderName: "Later",
      })],
    })

    expect(imported!.savedItem.id).toBe(captured.savedItem.savedItem.id)
    expect(await count("saved_items", "user_id = $1", [userId])).toBe(1)
    // The server's fields stay: the shared Link is not rewritten from the device.
    expect(imported!.metadata.title).toBeUndefined()
    expect(imported!.enrichment.previewSummary).toBeUndefined()
    expect(imported!.enrichment.tags).toEqual([])
    expect(imported!.savedItem.captureChannel).toBe("chrome-extension")
    expect(imported!.savedItem.createdAt.toISOString()).not.toBe(savedAt.toISOString())
    // Read state and a Folder are what the import may add.
    expect(imported!.savedItem.isRead).toBe(true)
    expect(imported!.folder?.name).toBe("Later")
  })

  test("never unreads a Saved Item, and never moves one that is already in a Folder", async () => {
    const userId = await newUser()

    const [first] = await importLibrary(userId, {
      folders: [{ name: "Work", emoji: null, color: null }, { name: "Home", emoji: null, color: null }],
      items: [item({ url: "https://example.com/filed", isRead: true, folderName: "Work" })],
    })

    const [second] = await importLibrary(userId, {
      folders: [],
      items: [item({ url: "https://example.com/filed", isRead: false, folderName: "Home" })],
    })

    expect(second!.savedItem.id).toBe(first!.savedItem.id)
    expect(second!.savedItem.isRead).toBe(true)
    expect(second!.folder?.name).toBe("Work")
  })

  test("keeps a Link another Account already saved as the server has it", async () => {
    const otherUserId = await newUser()
    const userId = await newUser()

    await importLibrary(otherUserId, {
      folders: [],
      items: [item({ url: "https://example.com/shared", title: "First title", tags: ["design"] })],
    })

    const [imported] = await importLibrary(userId, {
      folders: [],
      items: [item({ url: "https://example.com/shared", title: "Second title", tags: ["security"] })],
    })

    expect(imported!.savedItem.userId).toBe(userId)
    expect(imported!.metadata.title).toBe("First title")
    expect(imported!.enrichment.tags).toEqual(["design"])
    expect(await count("links")).toBe(1)
  })

  test("matches a Folder of the Account by name, ignoring case", async () => {
    const userId = await newUser()
    await withPool((pool) =>
      pool.query(`insert into folders (id, user_id, name, emoji) values ($1, $2, 'Research', '🔬')`, [randomUUID(), userId]))

    const [listed, unlisted, unknown] = await importLibrary(userId, {
      folders: [{ name: "  research ", emoji: "📁", color: "red" }],
      items: [
        item({ url: "https://example.com/a", folderName: "RESEARCH" }),
        item({ url: "https://example.com/b", folderName: "research" }),
        item({ url: "https://example.com/c", folderName: "Nowhere" }),
      ],
    })

    expect(await count("folders", "user_id = $1", [userId])).toBe(1)
    // The Account's Folder keeps its own name and emoji.
    expect(listed!.folder?.name).toBe("Research")
    expect(listed!.folder?.emoji).toBe("🔬")
    expect(unlisted!.folder?.id).toBe(listed!.folder!.id)
    expect(unknown!.folder).toBeUndefined()
  })

  test("creates nothing the second time the same import runs", async () => {
    const userId = await newUser()
    const library = {
      folders: [{ name: "Reading", emoji: null, color: null }],
      items: [
        item({ url: "https://example.com/a", folderName: "Reading", tags: ["ai"] }),
        item({ url: "https://example.com/b", isRead: true }),
      ],
    }

    const first = await importLibrary(userId, library)
    const second = await importLibrary(userId, library)

    expect(second.map((saved) => saved.savedItem.id)).toEqual(first.map((saved) => saved.savedItem.id))
    expect(await count("saved_items", "user_id = $1", [userId])).toBe(2)
    expect(await count("folders", "user_id = $1", [userId])).toBe(1)
    expect(await count("links")).toBe(2)
  })

  test("refuses the whole import for one invalid URL and writes nothing", async () => {
    const userId = await newUser()

    const exit = await withTestDatabaseUrl(() =>
      Effect.runPromise(Effect.gen(function* () {
        const localLibrary = yield* LocalLibraryImport
        return yield* localLibrary.import(userId, {
          folders: [{ name: "Reading", emoji: null, color: null }],
          items: [item({ url: "https://example.com/good" }), item({ url: "ftp://example.com/bad" })],
        })
      }).pipe(Effect.provide(persistenceLayer), Effect.exit)))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(await count("saved_items", "user_id = $1", [userId])).toBe(0)
    expect(await count("folders", "user_id = $1", [userId])).toBe(0)
  })
})
