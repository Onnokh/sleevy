import { beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Effect, Layer, Option } from "effect"
import { Pool } from "pg"

import type { FolderId, SavedItemId, UserId } from "../../src/domain/SavedItem.js"
import { Analytics } from "../../src/modules/analytics/Analytics.js"
import {
  JevClassifier,
  type FilingCandidate,
  type FilingSubject,
} from "../../src/modules/ai/JevClassifier.js"
import { AutoFiling } from "../../src/modules/auto-filing/AutoFiling.js"
import { FolderRepository } from "../../src/modules/folders/FolderRepository.js"
import { PostgresClient } from "../../src/modules/persistence/PostgresClient.js"
import { ProfileRepository } from "../../src/modules/profiles/ProfileRepository.js"
import { PublicProfileCachePurger } from "../../src/modules/profiles/PublicProfileCachePurger.js"
import { SavedItemRepository } from "../../src/modules/saved-items/SavedItemRepository.js"
import { AccountSettingsRepository } from "../../src/modules/settings/AccountSettingsRepository.js"
import {
  cleanTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
  withTestDatabaseUrl,
} from "../lib/postgres.js"

type JevCall = { readonly subject: FilingSubject; readonly candidates: readonly FilingCandidate<string>[] }

// Jev's folder choice is generic over the candidate id; a stub answers with
// whichever id it was given, so it is typed over plain strings.
const folderStub = (
  choose: (subject: FilingSubject, candidates: readonly FilingCandidate<string>[]) => Effect.Effect<Option.Option<string>>,
) => choose as JevClassifier["Service"]["folder"]

// Jev is the only double: the settings, the Folders, the example titles and
// the "only while still unfiled" write are all Postgres behaviour.
const jevChoosing = (pick: (candidates: readonly FilingCandidate<string>[]) => string | undefined, calls: JevCall[]) =>
  Layer.succeed(JevClassifier, JevClassifier.of({
    enabled: true,
    tags: () => Effect.succeed(Option.none()),
    folder: folderStub((subject, candidates) =>
      Effect.sync(() => {
        calls.push({ subject, candidates })
        return Option.fromUndefinedOr(pick(candidates))
      })),
  }))

const runIntegration = <A, E>(
  jev: Layer.Layer<JevClassifier>,
  effect: Effect.Effect<A, E, AutoFiling | AccountSettingsRepository>,
) =>
  withTestDatabaseUrl(() =>
    Effect.runPromise(effect.pipe(
      Effect.provide(Layer.mergeAll(
        AutoFiling.layer.pipe(
          Layer.provide(jev),
          Layer.provide(AccountSettingsRepository.defaultLayer),
          Layer.provide(FolderRepository.defaultLayer),
          Layer.provide(SavedItemRepository.defaultLayer),
          Layer.provide(ProfileRepository.defaultLayer),
          Layer.provide(PostgresClient.defaultLayer),
          Layer.provide(Layer.succeed(PublicProfileCachePurger, PublicProfileCachePurger.of({
            purge: () => Effect.void,
          } as never))),
          Layer.provide(Layer.succeed(Analytics, Analytics.of({ track: () => Effect.void } as never))),
        ),
        AccountSettingsRepository.defaultLayer,
      )),
    )),
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

const newFolder = (userId: UserId, name: string) =>
  withPool(async (pool) => {
    const id = randomUUID() as FolderId
    await pool.query(`insert into folders (id, user_id, name) values ($1, $2, $3)`, [id, userId, name])
    return id
  })

const newSavedItem = (userId: UserId, title: string, folderId: FolderId | null = null) =>
  withPool(async (pool) => {
    const linkId = randomUUID()
    const savedItemId = randomUUID() as SavedItemId
    const url = `https://example.com/${linkId}`
    await pool.query(`insert into links (id, original_url, normalized_url, host) values ($1, $2, $2, 'example.com')`, [linkId, url])
    await pool.query(`insert into link_metadata (link_id, title) values ($1, $2)`, [linkId, title])
    await pool.query(`insert into link_enrichment (link_id, type, tags, status) values ($1, 'article', '{backend}', 'enriched')`, [linkId])
    await pool.query(
      `insert into saved_items (id, user_id, link_id, folder_id) values ($1, $2, $3, $4)`,
      [savedItemId, userId, linkId, folderId],
    )
    return savedItemId
  })

const folderOf = (savedItemId: SavedItemId) =>
  withPool(async (pool) => {
    const result = await pool.query<{ folder_id: string | null }>(
      `select folder_id from saved_items where id = $1`,
      [savedItemId],
    )
    return result.rows[0]?.folder_id ?? null
  })

const setFolder = (savedItemId: SavedItemId, folderId: FolderId) =>
  withPool((pool) => pool.query(`update saved_items set folder_id = $2 where id = $1`, [savedItemId, folderId]))

beforeAll(async () => {
  await setupTestDatabase()
})

beforeEach(async () => {
  await cleanTestDatabase()
})

describe("auto-filing integration flow", () => {
  test("reads Auto-Filing as on for a new Account, and keeps it off once turned off", async () => {
    const userId = await newUser()
    const calls: JevCall[] = []

    const [before, after] = await runIntegration(
      jevChoosing(() => undefined, calls),
      Effect.gen(function* () {
        const settings = yield* AccountSettingsRepository
        const before = yield* settings.findByUser(userId)
        yield* settings.update(userId, { autoFiling: false })
        return [before, yield* settings.findByUser(userId)] as const
      }),
    )

    expect(before).toEqual({ autoFiling: true })
    expect(after).toEqual({ autoFiling: false })
  })

  test("files an unfiled Saved Item into the Folder Jev chose, showing it what each Folder holds", async () => {
    const userId = await newUser()
    const rust = await newFolder(userId, "Rust")
    await newFolder(userId, "Recipes")
    await newSavedItem(userId, "Tokio tutorial", rust)
    const item = await newSavedItem(userId, "tokio-rs/axum")
    const calls: JevCall[] = []

    const outcome = await runIntegration(
      jevChoosing((candidates) => candidates.find((folder) => folder.name === "Rust")?.id, calls),
      Effect.flatMap(AutoFiling, (autoFiling) => autoFiling.file(userId, item)),
    )

    expect(outcome).toEqual({ _tag: "filed", folderId: rust })
    expect(await folderOf(item)).toBe(rust)
    expect(calls[0]?.subject.title).toBe("tokio-rs/axum")
    expect(calls[0]?.subject.tags).toEqual(["backend"])
    expect(calls[0]?.candidates.map((folder) => [folder.name, folder.examples])).toEqual([
      ["Recipes", []],
      ["Rust", ["Tokio tutorial"]],
    ])
  })

  test("leaves the Saved Item unfiled when no Folder fits", async () => {
    const userId = await newUser()
    await newFolder(userId, "Recipes")
    const item = await newSavedItem(userId, "Election results")

    const outcome = await runIntegration(
      jevChoosing(() => undefined, []),
      Effect.flatMap(AutoFiling, (autoFiling) => autoFiling.file(userId, item)),
    )

    expect(outcome).toEqual({ _tag: "skipped", reason: "no-fit" })
    expect(await folderOf(item)).toBeNull()
  })

  test("asks Jev nothing when Auto-Filing is off or the Account has no Folders", async () => {
    const noFolders = await newUser()
    const noFoldersItem = await newSavedItem(noFolders, "Anything")
    const off = await newUser()
    const offFolder = await newFolder(off, "Rust")
    const offItem = await newSavedItem(off, "Rust 2024 edition")
    const calls: JevCall[] = []

    const outcomes = await runIntegration(
      jevChoosing(() => offFolder, calls),
      Effect.gen(function* () {
        yield* (yield* AccountSettingsRepository).update(off, { autoFiling: false })
        const autoFiling = yield* AutoFiling
        return [yield* autoFiling.file(noFolders, noFoldersItem), yield* autoFiling.file(off, offItem)]
      }),
    )

    expect(outcomes).toEqual([
      { _tag: "skipped", reason: "no-folders" },
      { _tag: "skipped", reason: "off" },
    ])
    expect(calls).toHaveLength(0)
    expect(await folderOf(offItem)).toBeNull()
  })

  test("never moves a Saved Item the person filed while Jev was answering", async () => {
    const userId = await newUser()
    const rust = await newFolder(userId, "Rust")
    const recipes = await newFolder(userId, "Recipes")
    const item = await newSavedItem(userId, "Tokio tutorial")

    const outcome = await runIntegration(
      Layer.succeed(JevClassifier, JevClassifier.of({
        enabled: true,
        tags: () => Effect.succeed(Option.none()),
        folder: folderStub(() =>
          Effect.promise(async () => {
            await setFolder(item, recipes)
            return Option.some<string>(rust)
          })),
      })),
      Effect.flatMap(AutoFiling, (autoFiling) => autoFiling.file(userId, item)),
    )

    expect(outcome).toEqual({ _tag: "skipped", reason: "already-filed" })
    expect(await folderOf(item)).toBe(recipes)
  })
})
