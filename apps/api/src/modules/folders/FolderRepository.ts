import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm"
import { Context, Effect, Layer, Option, Schema } from "effect"

import { Folder, type FolderId, type UserId } from "../../domain/SavedItem.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import { foldersTable, linkMetadataTable, savedItemsTable } from "../persistence/schema.js"

const decodeFolder = Schema.decodeUnknownSync(Folder)

const toFolder = (record: typeof foldersTable.$inferSelect): Folder =>
  decodeFolder(record)

export class FolderRepository extends Context.Service<FolderRepository>()(
  "@app/modules/folders/FolderRepository",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      return {
        listByUser: Effect.fn("FolderRepository.listByUser")(function* (userId: UserId) {
          const rows = yield* db
            .select()
            .from(foldersTable)
            .where(eq(foldersTable.userId, userId))
            .orderBy(asc(sql`lower(${foldersTable.name})`), asc(foldersTable.id))
          return rows.map(toFolder)
        }),

        // The newest few titles in each Folder show a classifier what the
        // person keeps there, which a bare name such as "Work" or "Later" does
        // not.
        exampleTitles: Effect.fn("FolderRepository.exampleTitles")(function* (userId: UserId, limit: number) {
          const ranked = db
            .select({
              folderId: savedItemsTable.folderId,
              title: linkMetadataTable.title,
              rank: sql<number>`row_number() over (partition by ${savedItemsTable.folderId} order by ${savedItemsTable.lastSavedAt} desc)`.as("rank"),
            })
            .from(savedItemsTable)
            .innerJoin(linkMetadataTable, eq(linkMetadataTable.linkId, savedItemsTable.linkId))
            .where(and(
              eq(savedItemsTable.userId, userId),
              isNotNull(savedItemsTable.folderId),
              isNotNull(linkMetadataTable.title),
            ))
            .as("ranked")

          const rows = yield* db
            .select({ folderId: ranked.folderId, title: ranked.title })
            .from(ranked)
            .where(sql`${ranked.rank} <= ${limit}`)
            .orderBy(ranked.folderId, ranked.rank)

          const byFolder = new Map<FolderId, string[]>()
          for (const row of rows) {
            if (!row.folderId || !row.title) continue
            const titles = byFolder.get(row.folderId) ?? []
            titles.push(row.title)
            byFolder.set(row.folderId, titles)
          }
          return byFolder
        }),

        findByUserAndId: Effect.fn("FolderRepository.findByUserAndId")(function* (userId: UserId, id: FolderId) {
          const [row] = yield* db
            .select()
            .from(foldersTable)
            .where(and(eq(foldersTable.userId, userId), eq(foldersTable.id, id)))
            .limit(1)
          return row ? Option.some(toFolder(row)) : Option.none<Folder>()
        }),

        findByNormalizedName: Effect.fn("FolderRepository.findByNormalizedName")(function* (userId: UserId, name: string, exceptId?: FolderId) {
          const [row] = yield* db
            .select()
            .from(foldersTable)
            .where(and(
              eq(foldersTable.userId, userId),
              sql`lower(${foldersTable.name}) = lower(${name})`,
              ...(exceptId ? [ne(foldersTable.id, exceptId)] : []),
            ))
            .limit(1)
          return row ? Option.some(toFolder(row)) : Option.none<Folder>()
        }),

        create: Effect.fn("FolderRepository.create")(function* (userId: UserId, name: string, emoji: string | null, color: string | null) {
          const [row] = yield* db
            .insert(foldersTable)
            .values({ userId, name, emoji, color })
            .onConflictDoNothing()
            .returning()
          return row ? Option.some(toFolder(row)) : Option.none<Folder>()
        }),

        // Every field is optional: an omitted field keeps its stored value, so
        // a name-only caller never clears the emoji, the color, or the publish
        // flag.
        update: Effect.fn("FolderRepository.update")(function* (
          userId: UserId,
          id: FolderId,
          changes: {
            readonly name?: string
            readonly emoji?: string | null
            readonly color?: string | null
            readonly isPublished?: boolean
          },
        ) {
          const [row] = yield* db
            .update(foldersTable)
            .set({
              ...(changes.name !== undefined ? { name: changes.name } : {}),
              ...(changes.emoji !== undefined ? { emoji: changes.emoji } : {}),
              ...(changes.color !== undefined ? { color: changes.color } : {}),
              ...(changes.isPublished !== undefined ? { isPublished: changes.isPublished } : {}),
              updatedAt: new Date(),
            })
            .where(and(eq(foldersTable.userId, userId), eq(foldersTable.id, id)))
            .returning()
          return row ? Option.some(toFolder(row)) : Option.none<Folder>()
        }),

        deleteByUserAndId: Effect.fn("FolderRepository.deleteByUserAndId")(function* (userId: UserId, id: FolderId) {
          const rows = yield* db
            .delete(foldersTable)
            .where(and(eq(foldersTable.userId, userId), eq(foldersTable.id, id)))
            .returning()
          return rows.length > 0
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(FolderRepository, FolderRepository.make)

  static readonly defaultLayer = FolderRepository.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
  )
}
