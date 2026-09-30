import { beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Effect, Layer, Option } from "effect"
import { Pool } from "pg"

import type { FolderId, SavedItemId, UserId } from "../../src/domain/SavedItem.js"
import { Analytics } from "../../src/modules/analytics/Analytics.js"
import {
  FolderProposer,
  type ExistingFolder,
  type ProposedFolder,
  type UnfiledLink,
} from "../../src/modules/ai/FolderProposer.js"
import { JevClassifier, type FilingCandidate, type FilingSubject } from "../../src/modules/ai/JevClassifier.js"
import { FolderRepository } from "../../src/modules/folders/FolderRepository.js"
import { Organizer, type OrganizeRun } from "../../src/modules/organize/Organizer.js"
import { PostgresClient } from "../../src/modules/persistence/PostgresClient.js"
import { ProfileRepository } from "../../src/modules/profiles/ProfileRepository.js"
import { PublicProfileCachePurger } from "../../src/modules/profiles/PublicProfileCachePurger.js"
import {
  cleanTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
  withTestDatabaseUrl,
} from "../lib/postgres.js"

type ProposerCall = { readonly existing: readonly ExistingFolder[]; readonly links: readonly UnfiledLink[] }

// The two model calls are the only doubles; the batches, the run row, the
// plan and the conditional writes are all Postgres behaviour.
const doubles = (
  propose: (call: ProposerCall) => readonly Omit<ProposedFolder, "keys">[] | readonly ProposedFolder[],
  file: (subject: FilingSubject, candidates: readonly FilingCandidate<string>[]) => string | undefined,
  calls: ProposerCall[],
) =>
  Layer.mergeAll(
    Layer.succeed(FolderProposer, FolderProposer.of({
      enabled: true,
      propose: (existing, links) =>
        Effect.sync(() => {
          calls.push({ existing, links })
          return propose({ existing, links }).map((folder) => ({ keys: [], ...folder }))
        }),
    })),
    Layer.succeed(JevClassifier, JevClassifier.of({
      enabled: true,
      tags: () => Effect.succeed(Option.none()),
      folder: ((subject: FilingSubject, candidates: readonly FilingCandidate<string>[]) =>
        Effect.succeed(Option.fromUndefinedOr(file(subject, candidates)))) as JevClassifier["Service"]["folder"],
    })),
  )

const run = <A, E>(models: Layer.Layer<FolderProposer | JevClassifier>, effect: Effect.Effect<A, E, Organizer>) =>
  withTestDatabaseUrl(() =>
    Effect.runPromise(effect.pipe(
      Effect.provide(Organizer.layer.pipe(
        Layer.provide(models),
        Layer.provide(FolderRepository.defaultLayer),
        Layer.provide(ProfileRepository.defaultLayer),
        Layer.provide(PostgresClient.defaultLayer),
        Layer.provide(Layer.succeed(PublicProfileCachePurger, PublicProfileCachePurger.of({
          purge: () => Effect.void,
        } as never))),
        Layer.provide(Layer.succeed(Analytics, Analytics.of({ track: () => Effect.void } as never))),
      )),
    )),
  )

// The run is forked; poll it until it leaves `running`, inside the same
// runtime so the fork is not interrupted.
const untilSettled = (userId: UserId) =>
  Effect.gen(function* () {
    const organizer = yield* Organizer
    const started = yield* organizer.start(userId)
    expect(started.status).toBe("running")
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const current: OrganizeRun = yield* organizer.get(userId)
      if (current.status !== "running") return current
      yield* Effect.sleep("25 millis")
    }
    throw new Error("Organize run did not settle")
  })

const withPool = async <A>(use: (pool: Pool) => Promise<A>) => {
  const pool = new Pool({ connectionString: testDatabaseUrl })
  try {
    return await use(pool)
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

const newFolder = (userId: UserId, name: string, emoji: string | null = null) =>
  withPool(async (pool) => {
    const id = randomUUID() as FolderId
    await pool.query(`insert into folders (id, user_id, name, emoji) values ($1, $2, $3, $4)`, [id, userId, name, emoji])
    return id
  })

let clock = 0
const newSavedItem = (userId: UserId, title: string, folderId: FolderId | null = null) =>
  withPool(async (pool) => {
    const linkId = randomUUID()
    const savedItemId = randomUUID() as SavedItemId
    const url = `https://example.com/${linkId}`
    clock += 1
    await pool.query(`insert into links (id, original_url, normalized_url, host) values ($1, $2, $2, 'example.com')`, [linkId, url])
    await pool.query(`insert into link_metadata (link_id, title) values ($1, $2)`, [linkId, title])
    await pool.query(
      `insert into saved_items (id, user_id, link_id, folder_id, last_saved_at)
       values ($1, $2, $3, $4, now() - make_interval(secs => $5))`,
      [savedItemId, userId, linkId, folderId, 100_000 - clock],
    )
    return savedItemId
  })

const folderOf = (savedItemId: SavedItemId) =>
  withPool(async (pool) => {
    const result = await pool.query<{ folder_id: string | null }>(`select folder_id from saved_items where id = $1`, [savedItemId])
    return result.rows[0]?.folder_id ?? null
  })

const folderNamed = (userId: UserId, name: string) =>
  withPool(async (pool) => {
    const result = await pool.query<{ id: string; emoji: string | null }>(
      `select id, emoji from folders where user_id = $1 and name = $2`,
      [userId, name],
    )
    return result.rows[0] ?? null
  })

beforeAll(async () => {
  await setupTestDatabase()
})

beforeEach(async () => {
  await cleanTestDatabase()
})

describe("organize integration flow", () => {
  test("plans every unfiled Saved Item into existing and proposed Folders, in the person's style", async () => {
    const userId = await newUser()
    const rust = await newFolder(userId, "Rust", "🦀")
    await newSavedItem(userId, "Tokio tutorial", rust)
    const axum = await newSavedItem(userId, "tokio-rs/axum")
    const curry = await newSavedItem(userId, "Chickpea curry")
    const soup = await newSavedItem(userId, "Lentil soup")
    const tent = await newSavedItem(userId, "Tent review")
    const election = await newSavedItem(userId, "Election results")
    const calls: ProposerCall[] = []

    const settled = await run(
      doubles(
        () => [
          { name: "Recipes", emoji: "🍲", color: null, keys: [] },
          { name: "Camping", emoji: "⛺", color: null, keys: [] },
        ],
        (subject, candidates) => {
          const pick = (name: string) => candidates.find((folder) => folder.name === name)?.id
          if (subject.title === "tokio-rs/axum") return pick("Rust")
          if (subject.title?.includes("curry") || subject.title?.includes("soup")) return pick("Recipes")
          if (subject.title === "Tent review") return pick("Camping")
          return undefined
        },
        calls,
      ),
      untilSettled(userId),
    )

    // The proposer saw the person's Folder, its emoji and what it holds.
    expect(calls[0]?.existing).toEqual([{ name: "Rust", emoji: "🦀", color: null, examples: ["Tokio tutorial"] }])
    expect(settled.status).toBe("ready")
    const plan = settled.plan!
    expect(plan.considered).toBe(5)
    // Camping got one Saved Item, below the bar for a new Folder, so it and
    // its move are dropped.
    expect(plan.newFolders.map((folder) => folder.name)).toEqual(["Recipes"])
    const recipesKey = plan.newFolders[0]!.key
    expect(plan.moves.map((move) => [move.savedItemId, move.folderId, move.newFolderKey]).sort()).toEqual([
      [axum, rust, null],
      [curry, null, recipesKey],
      [soup, null, recipesKey],
    ].sort())
    expect(plan.moves.some((move) => move.savedItemId === tent || move.savedItemId === election)).toBe(false)

    // Nothing moved yet.
    expect(await folderOf(axum)).toBeNull()
  })

  test("works through a big Library in batches, each seeing the Folders proposed before it", async () => {
    const userId = await newUser()
    for (let index = 0; index < 120; index += 1) await newSavedItem(userId, `Item ${index}`)
    const calls: ProposerCall[] = []

    const settled = await run(
      doubles(
        ({ existing }) => [{ name: `Batch ${existing.length + 1}`, emoji: null, color: null }],
        () => undefined,
        calls,
      ),
      untilSettled(userId),
    )

    expect(settled.status).toBe("ready")
    expect(settled.plan?.considered).toBe(120)
    expect(calls.map((call) => call.links.length)).toEqual([50, 50, 20])
    expect(calls.map((call) => call.existing.map((folder) => folder.name))).toEqual([
      [],
      ["Batch 1"],
      ["Batch 1", "Batch 2"],
    ])
  })

  test("applies only the kept moves, makes only the Folders they need, and never moves a filed Saved Item", async () => {
    const userId = await newUser()
    const rust = await newFolder(userId, "Rust")
    const reading = await newFolder(userId, "Reading")
    const axum = await newSavedItem(userId, "tokio-rs/axum")
    const curry = await newSavedItem(userId, "Chickpea curry")
    const tent = await newSavedItem(userId, "Tent review")
    const filedMeanwhile = await newSavedItem(userId, "Rust 2024 edition")
    await withPool((pool) => pool.query(`update saved_items set folder_id = $2 where id = $1`, [filedMeanwhile, reading]))

    const result = await run(
      doubles(() => [], () => undefined, []),
      Effect.flatMap(Organizer, (organizer) =>
        organizer.apply(userId, {
          newFolders: [
            { key: "new-1", name: "Recipes", emoji: "🍲", color: "green" },
            { key: "new-2", name: "Camping", emoji: null, color: null },
            { key: "new-3", name: "rust", emoji: null, color: null },
          ],
          moves: [
            { savedItemId: axum, folderId: null, newFolderKey: "new-3" },
            { savedItemId: curry, folderId: null, newFolderKey: "new-1" },
            { savedItemId: filedMeanwhile, folderId: rust, newFolderKey: null },
          ],
        })),
    )

    // Recipes was made; "rust" reused the existing Rust; Camping had no kept move.
    expect(result).toEqual({ filed: 2, foldersCreated: 1 })
    const recipes = await folderNamed(userId, "Recipes")
    expect(recipes?.emoji).toBe("🍲")
    expect(await folderNamed(userId, "Camping")).toBeNull()
    expect(await folderOf(axum)).toBe(rust)
    expect(await folderOf(curry)).toBe(recipes?.id ?? "missing")
    expect(await folderOf(tent)).toBeNull()
    expect(await folderOf(filedMeanwhile)).toBe(reading)
  })

  test("keeps one run per Account and lets a finished plan be discarded", async () => {
    const userId = await newUser()
    await newFolder(userId, "Rust")
    await newSavedItem(userId, "tokio-rs/axum")

    const [second, afterDiscard] = await run(
      doubles(() => [], () => undefined, []),
      Effect.gen(function* () {
        const organizer = yield* Organizer
        yield* untilSettled(userId)
        const second = yield* organizer.start(userId)
        yield* untilSettledAgain(userId)
        yield* organizer.discard(userId)
        return [second, yield* organizer.get(userId)] as const
      }),
    )

    expect(second.status).toBe("running")
    expect(afterDiscard.status).toBe("idle")
  })
})

const untilSettledAgain = (userId: UserId) =>
  Effect.gen(function* () {
    const organizer = yield* Organizer
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if ((yield* organizer.get(userId)).status !== "running") return
      yield* Effect.sleep("25 millis")
    }
  })
