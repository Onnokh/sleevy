import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { Context, Data, Effect, Layer, Option, Schema } from "effect"

import type { FolderId, SavedItemId, Topic, UserId } from "../../domain/SavedItem.js"
import { Analytics } from "../analytics/Analytics.js"
import {
  FOLDER_COLORS,
  FolderProposer,
  type ExistingFolder,
  type ProposedFolder,
  type UnfiledLink,
} from "../ai/FolderProposer.js"
import { FOLDER_EXAMPLE_LIMIT, JevClassifier, type FilingCandidate } from "../ai/JevClassifier.js"
import { FolderRepository } from "../folders/FolderRepository.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import {
  linkEnrichmentTable,
  linkMetadataTable,
  linksTable,
  organizeRunsTable,
  savedItemsTable,
} from "../persistence/schema.js"
import { ProfileRepository } from "../profiles/ProfileRepository.js"
import { PublicProfileCachePurger } from "../profiles/PublicProfileCachePurger.js"

export class OrganizeFailed extends Data.TaggedError("OrganizeFailed")<{
  readonly message: string
}> {}

/** Saved Items handled per step: one proposal request, one filing round. */
export const ORGANIZE_BATCH_SIZE = 50

/** The most unfiled Saved Items one run looks at, newest first. */
export const ORGANIZE_ITEM_LIMIT = 2000

/** Across the whole run, so a big Library does not end up with dozens of new Folders. */
export const MAX_NEW_FOLDERS = 12

/** A proposed Folder is only kept when Jev files at least this many Saved Items into it. */
export const MIN_NEW_FOLDER_ITEMS = 2

const FILING_CONCURRENCY = 8

/** A run that has not written progress for this long lost its process. */
const STALE_AFTER_MS = 5 * 60_000

const OrganizePlan = Schema.Struct({
  newFolders: Schema.Array(Schema.Struct({
    key: Schema.String,
    name: Schema.String,
    emoji: Schema.NullOr(Schema.String),
    color: Schema.NullOr(Schema.String),
  })),
  moves: Schema.Array(Schema.Struct({
    savedItemId: Schema.String,
    title: Schema.NullOr(Schema.String),
    url: Schema.String,
    folderId: Schema.NullOr(Schema.String),
    newFolderKey: Schema.NullOr(Schema.String),
  })),
  considered: Schema.Number,
})
export type OrganizePlan = typeof OrganizePlan.Type
const decodePlan = Schema.decodeUnknownSync(OrganizePlan)

export type OrganizeRun = {
  readonly status: "idle" | "running" | "ready" | "failed"
  readonly phase: "proposing" | "filing" | null
  readonly done: number
  readonly total: number
  readonly plan: OrganizePlan | null
}

export type OrganizeApply = {
  readonly newFolders: OrganizePlan["newFolders"]
  readonly moves: readonly {
    readonly savedItemId: string
    readonly folderId: string | null
    readonly newFolderKey: string | null
  }[]
}

const idle: OrganizeRun = { status: "idle", phase: null, done: 0, total: 0, plan: null }

type RunRow = typeof organizeRunsTable.$inferSelect

const isStale = (row: RunRow) =>
  row.status === "running" && Date.now() - row.updatedAt.getTime() > STALE_AFTER_MS

const toRun = (row: RunRow | undefined): OrganizeRun => {
  if (!row) return idle
  if (isStale(row)) return { status: "failed", phase: null, done: row.done, total: row.total, plan: null }
  return {
    status: row.status,
    phase: row.status === "running" ? row.phase : null,
    done: row.done,
    total: row.total,
    plan: row.status === "ready" && row.plan ? decodePlan(row.plan) : null,
  }
}

type UnfiledItem = {
  readonly id: SavedItemId
  readonly url: string
  readonly host: string
  readonly title: string | null
  readonly description: string | null
  readonly siteName: string | null
  readonly previewSummary: string | null
  readonly tags: readonly Topic[]
}

const chunk = <A>(items: readonly A[], size: number) => {
  const chunks: A[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

/**
 * Organize: sorts every unfiled Saved Item of an Account into Folders, as a
 * plan the person reviews before anything moves.
 *
 * It works in two passes over batches of 50. First a language model proposes
 * new Folders for groups that no existing Folder covers, in the style of the
 * Folders the person already made; each batch sees the Folders proposed before
 * it, so names stay consistent. Then Jev files every Saved Item into the
 * existing or proposed Folder that clearly fits, the same way Auto-Filing
 * does. A proposed Folder that Jev fills with fewer than two Saved Items is
 * dropped, and a Saved Item that fits nowhere is left out of the plan.
 */
export class Organizer extends Context.Service<Organizer>()(
  "@app/modules/organize/Organizer",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient
      const folders = yield* FolderRepository
      const jev = yield* JevClassifier
      const proposer = yield* FolderProposer
      const profiles = yield* ProfileRepository
      const cachePurger = yield* PublicProfileCachePurger
      const analytics = yield* Analytics

      const findRow = Effect.fn("Organizer.findRow")(function* (userId: UserId) {
        const [row] = yield* db.select().from(organizeRunsTable).where(eq(organizeRunsTable.userId, userId)).limit(1)
        return row
      })

      // Every write names the run it belongs to, so a run that lost its
      // process and was started again is never overwritten by the old one.
      const progress = (userId: UserId, startedAt: Date, changes: Partial<typeof organizeRunsTable.$inferInsert>) =>
        db
          .update(organizeRunsTable)
          .set({ ...changes, updatedAt: new Date() })
          .where(and(eq(organizeRunsTable.userId, userId), eq(organizeRunsTable.startedAt, startedAt)))

      const unfiledItems = Effect.fn("Organizer.unfiledItems")(function* (userId: UserId) {
        const rows = yield* db
          .select({
            id: savedItemsTable.id,
            url: linksTable.originalUrl,
            host: linksTable.host,
            savedTags: savedItemsTable.tags,
            title: linkMetadataTable.title,
            description: linkMetadataTable.description,
            siteName: linkMetadataTable.siteName,
            previewSummary: linkEnrichmentTable.previewSummary,
            enrichmentTags: linkEnrichmentTable.tags,
          })
          .from(savedItemsTable)
          .innerJoin(linksTable, eq(linksTable.id, savedItemsTable.linkId))
          .leftJoin(linkMetadataTable, eq(linkMetadataTable.linkId, savedItemsTable.linkId))
          .leftJoin(linkEnrichmentTable, eq(linkEnrichmentTable.linkId, savedItemsTable.linkId))
          .where(and(eq(savedItemsTable.userId, userId), isNull(savedItemsTable.folderId)))
          .orderBy(desc(savedItemsTable.lastSavedAt))
          .limit(ORGANIZE_ITEM_LIMIT)

        return rows.map((row): UnfiledItem => ({
          id: row.id,
          url: row.url,
          host: row.host,
          title: row.title ?? null,
          description: row.description ?? null,
          siteName: row.siteName ?? null,
          previewSummary: row.previewSummary ?? null,
          // The Effective Tags: the person's own when they gave any.
          tags: (row.savedTags.length > 0 ? row.savedTags : row.enrichmentTags ?? []) as Topic[],
        }))
      })

      const plan = Effect.fn("Organizer.plan")(function* (userId: UserId, startedAt: Date) {
        const items = yield* unfiledItems(userId)
        const accountFolders = yield* folders.listByUser(userId)
        const examples = yield* folders.exampleTitles(userId, FOLDER_EXAMPLE_LIMIT)
        const existing: ExistingFolder[] = accountFolders.map((folder) => ({
          name: folder.name,
          emoji: folder.emoji,
          color: folder.color,
          examples: examples.get(folder.id) ?? [],
        }))
        const byKey = new Map(items.map((item, index) => [String(index + 1), item]))
        const keyOf = new Map(items.map((item, index) => [item.id, String(index + 1)]))

        // Pass one: new Folders, batch by batch. Each batch sees the Folders
        // proposed so far as if they existed, so it adds to them rather than
        // proposing the same subject under another name.
        const proposed: (ProposedFolder & { readonly key: string })[] = []
        if (proposer.enabled) {
          yield* progress(userId, startedAt, { phase: "proposing", done: 0, total: items.length })
          let done = 0
          for (const batch of chunk(items, ORGANIZE_BATCH_SIZE)) {
            if (proposed.length >= MAX_NEW_FOLDERS) break
            const links: UnfiledLink[] = batch.map((item) => ({
              key: keyOf.get(item.id)!,
              title: item.title,
              host: item.host,
              previewSummary: item.previewSummary,
              tags: item.tags,
            }))
            const soFar: ExistingFolder[] = proposed.map((folder) => ({
              name: folder.name,
              emoji: folder.emoji,
              color: folder.color,
              examples: folder.keys.slice(0, FOLDER_EXAMPLE_LIMIT).flatMap((key) => byKey.get(key)?.title ?? []),
            }))
            const next = yield* proposer.propose([...existing, ...soFar], links).pipe(
              Effect.catch((cause) =>
                Effect.logWarning("Organize could not propose Folders for a batch", cause).pipe(
                  Effect.as([] as readonly ProposedFolder[]),
                )),
            )
            for (const folder of next) {
              if (proposed.length >= MAX_NEW_FOLDERS) break
              proposed.push({ ...folder, key: `new-${proposed.length + 1}` })
            }
            done += batch.length
            yield* progress(userId, startedAt, { done })
          }
        }

        // Pass two: Jev files every Saved Item among the existing and the
        // proposed Folders.
        const candidates: FilingCandidate<string>[] = [
          ...accountFolders.map((folder) => ({
            id: folder.id as string,
            name: folder.name,
            examples: examples.get(folder.id) ?? [],
          })),
          ...proposed.map((folder) => ({
            id: folder.key,
            name: folder.name,
            examples: folder.keys.slice(0, FOLDER_EXAMPLE_LIMIT).flatMap((key) => byKey.get(key)?.title ?? []),
          })),
        ]

        yield* progress(userId, startedAt, { phase: "filing", done: 0, total: items.length })
        const choices = new Map<SavedItemId, string>()
        let failures = 0
        if (candidates.length > 0) {
          let done = 0
          for (const batch of chunk(items, ORGANIZE_BATCH_SIZE)) {
            yield* Effect.forEach(batch, (item) =>
              jev.folder(
                {
                  url: item.url,
                  title: item.title,
                  description: item.description,
                  siteName: item.siteName,
                  previewSummary: item.previewSummary,
                  tags: item.tags,
                },
                candidates,
              ).pipe(
                Effect.tap((choice) => Effect.sync(() => {
                  if (Option.isSome(choice)) choices.set(item.id, choice.value)
                })),
                Effect.catch((cause) => {
                  failures += 1
                  return Effect.logWarning("Organize could not file a Saved Item", cause)
                }),
              ), { concurrency: FILING_CONCURRENCY, discard: true })
            done += batch.length
            yield* progress(userId, startedAt, { done })
          }
        }
        if (items.length > 0 && failures === items.length) {
          return yield* new OrganizeFailed({ message: "Jev answered no Saved Item" })
        }

        const counts = new Map<string, number>()
        for (const target of choices.values()) counts.set(target, (counts.get(target) ?? 0) + 1)
        const keptNew = proposed.filter((folder) => (counts.get(folder.key) ?? 0) >= MIN_NEW_FOLDER_ITEMS)
        const newKeys = new Set(keptNew.map((folder) => folder.key))
        const existingIds = new Set<string>(accountFolders.map((folder) => folder.id))

        const moves: OrganizePlan["moves"][number][] = []
        for (const item of items) {
          const target = choices.get(item.id)
          if (!target) continue
          if (existingIds.has(target)) {
            moves.push({ savedItemId: item.id, title: item.title, url: item.url, folderId: target, newFolderKey: null })
          } else if (newKeys.has(target)) {
            moves.push({ savedItemId: item.id, title: item.title, url: item.url, folderId: null, newFolderKey: target })
          }
        }

        return {
          newFolders: keptNew.map((folder) => ({
            key: folder.key,
            name: folder.name,
            emoji: folder.emoji,
            color: folder.color,
          })),
          moves,
          considered: items.length,
        } satisfies OrganizePlan
      })

      const get = Effect.fn("Organizer.get")(function* (userId: UserId) {
        return toRun(yield* findRow(userId))
      })

      const start = Effect.fn("Organizer.start")(function* (userId: UserId) {
        const startedAt = new Date()
        // Takes the Account's one run slot unless a live run holds it.
        const [claimed] = yield* db
          .insert(organizeRunsTable)
          .values({ userId, status: "running", phase: null, done: 0, total: 0, plan: null, startedAt, updatedAt: startedAt })
          .onConflictDoUpdate({
            target: organizeRunsTable.userId,
            set: { status: "running", phase: null, done: 0, total: 0, plan: null, startedAt, updatedAt: startedAt },
            setWhere: sql`${organizeRunsTable.status} <> 'running' or ${organizeRunsTable.updatedAt} < ${new Date(Date.now() - STALE_AFTER_MS)}`,
          })
          .returning()
        if (!claimed) return toRun(yield* findRow(userId))

        yield* plan(userId, startedAt).pipe(
          Effect.flatMap((result) => progress(userId, startedAt, { status: "ready", phase: null, plan: result })),
          Effect.catchCause((cause) =>
            Effect.logError("Organize run failed", cause).pipe(
              Effect.andThen(progress(userId, startedAt, { status: "failed", phase: null })),
              Effect.ignore,
            )),
          Effect.annotateLogs({ userId }),
          Effect.forkDetach,
        )
        return toRun(claimed)
      })

      const discard = Effect.fn("Organizer.discard")(function* (userId: UserId) {
        const row = yield* findRow(userId)
        if (row && row.status === "running" && !isStale(row)) return toRun(row)
        yield* db.delete(organizeRunsTable).where(eq(organizeRunsTable.userId, userId))
        return idle
      })

      const apply = Effect.fn("Organizer.apply")(function* (userId: UserId, kept: OrganizeApply) {
        const accountFolders = yield* folders.listByUser(userId)
        const existingIds = new Set<string>(accountFolders.map((folder) => folder.id))
        const usedKeys = new Set(kept.moves.flatMap((move) => move.newFolderKey ?? []))

        // New Folders are made only for kept moves. A name the Account already
        // uses, perhaps made since the plan, reuses that Folder.
        const madeFor = new Map<string, FolderId>()
        let foldersCreated = 0
        for (const folder of kept.newFolders) {
          if (!usedKeys.has(folder.key) || madeFor.has(folder.key)) continue
          const name = folder.name.trim()
          if (name.length === 0 || name.length > 80) continue
          const found = yield* folders.findByNormalizedName(userId, name)
          if (Option.isSome(found)) {
            madeFor.set(folder.key, found.value.id)
            continue
          }
          const color = folder.color && (FOLDER_COLORS as readonly string[]).includes(folder.color) ? folder.color : null
          const created = yield* folders.create(userId, name, folder.emoji?.trim() || null, color)
          if (Option.isSome(created)) {
            madeFor.set(folder.key, created.value.id)
            foldersCreated += 1
          } else {
            const raced = yield* folders.findByNormalizedName(userId, name)
            if (Option.isSome(raced)) madeFor.set(folder.key, raced.value.id)
          }
        }

        const byTarget = new Map<FolderId, SavedItemId[]>()
        const seen = new Set<string>()
        for (const move of kept.moves) {
          if (seen.has(move.savedItemId)) continue
          seen.add(move.savedItemId)
          const target = move.folderId && existingIds.has(move.folderId)
            ? move.folderId as FolderId
            : move.newFolderKey
              ? madeFor.get(move.newFolderKey)
              : undefined
          if (!target) continue
          byTarget.set(target, [...(byTarget.get(target) ?? []), move.savedItemId as SavedItemId])
        }

        // Only an item that is still unfiled moves: one the person filed since
        // the plan keeps its Folder.
        let filed = 0
        for (const [folderId, ids] of byTarget) {
          for (const idsBatch of chunk(ids, 500)) {
            const rows = yield* db
              .update(savedItemsTable)
              .set({ folderId, updatedAt: new Date() })
              .where(and(
                eq(savedItemsTable.userId, userId),
                inArray(savedItemsTable.id, idsBatch),
                isNull(savedItemsTable.folderId),
              ))
              .returning({ id: savedItemsTable.id })
            filed += rows.length
          }
        }

        const published = accountFolders.some((folder) => folder.isPublished && byTarget.has(folder.id))
        if (published) {
          const profile = yield* profiles.findByUser(userId)
          if (Option.isSome(profile) && profile.value.visibility === "public") {
            yield* cachePurger.purge(profile.value.handle)
          }
        }

        yield* db.delete(organizeRunsTable).where(and(
          eq(organizeRunsTable.userId, userId),
          sql`${organizeRunsTable.status} <> 'running'`,
        ))
        yield* analytics.track({ name: "library_organized", userId }).pipe(Effect.forkDetach)

        return { filed, foldersCreated }
      })

      return { available: jev.enabled, get, start, discard, apply }
    }),
  },
) {
  static readonly layer = Layer.effect(Organizer, Organizer.make)

  static readonly defaultLayer = Organizer.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
    Layer.provide(FolderRepository.defaultLayer),
    Layer.provide(JevClassifier.defaultLayer),
    Layer.provide(FolderProposer.defaultLayer),
    Layer.provide(ProfileRepository.defaultLayer),
    Layer.provide(PublicProfileCachePurger.defaultLayer),
    Layer.provide(Analytics.defaultLayer),
  )
}
