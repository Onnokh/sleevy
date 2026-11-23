import { topics } from "@sleevy/contract"
import { and, eq, inArray, sql } from "drizzle-orm"
import { Context, Data, Effect, Layer } from "effect"

import type {
  FolderId,
  SavedItemId,
  SavedItemWithLink,
  Topic,
  UserId,
} from "../../domain/SavedItem.js"
import { InvalidUrl } from "../capture/CaptureError.js"
import { normalizeCaptureUrl } from "../capture/CaptureService.js"
import type { NormalizedCaptureUrl } from "../capture/CaptureServiceStore.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import {
  foldersTable,
  linkEnrichmentTable,
  linkMetadataTable,
  linksTable,
  savedItemsTable,
  sourcesTable,
} from "../persistence/schema.js"
import { toSavedItemWithLink } from "../saved-items/SavedItemRepository.js"

export class InvalidLocalLibraryFolderName extends Data.TaggedError("InvalidLocalLibraryFolderName")<{
  readonly name: string
}> {}

export type LocalLibraryFolder = {
  readonly name: string
  readonly emoji: string | null
  readonly color: string | null
}

export type LocalLibraryItem = {
  readonly url: string
  readonly title: string | null
  readonly description: string | null
  readonly siteName: string | null
  readonly faviconUrl: string | null
  readonly previewSummary: string | null
  readonly tags: ReadonlyArray<string>
  readonly isRead: boolean
  readonly savedAt: Date
  readonly folderName: string | null
}

export type LocalLibrary = {
  readonly folders: ReadonlyArray<LocalLibraryFolder>
  readonly items: ReadonlyArray<LocalLibraryItem>
}

// The same rule the Folder Endpoint applies to a name.
const MAX_FOLDER_NAME_LENGTH = 80

const folderKey = (name: string) => name.trim().toLowerCase()

const text = (value: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

// A Tag is a word from the closed vocabulary. The device may know a Tag this
// server does not, so an unknown one is dropped rather than refused.
const toTags = (values: ReadonlyArray<string>): Topic[] => {
  const known = new Set<string>(topics)
  const tags: Topic[] = []
  for (const value of values) {
    const tag = value.trim().toLowerCase()
    if (known.has(tag) && !tags.includes(tag as Topic)) tags.push(tag as Topic)
  }
  return tags
}

/**
 * Imports a Local Library into an Account.
 *
 * The device already enriched every item, so the import keeps what the device
 * sent and starts nothing after it: no Enrichment Job, no Readable Content, no
 * Content Check, no Jev Classifier and no Auto-Filing. Capture is what starts
 * those, and this does not go through capture.
 *
 * What the device sent is written only to what the device owns. A Link that no
 * Account has saved yet takes the device's Link Metadata and Link Enrichment;
 * a Link the server already knows keeps its own, because it is shared with
 * every Account that saved it. A Saved Item the Account already has keeps its
 * fields too, and only gains the read state and a Folder.
 *
 * It is one transaction, so a failed import leaves nothing half done, and it
 * matches by Normalized URL and Folder name, so the same import twice changes
 * nothing the second time.
 */
export class LocalLibraryImport extends Context.Service<LocalLibraryImport>()(
  "@app/modules/local-library/LocalLibraryImport",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      return {
        import: Effect.fn("LocalLibraryImport.import")(function* (userId: UserId, library: LocalLibrary) {
          // Check everything before the first write, so a bad URL or Folder
          // name refuses the request rather than the rest of it.
          const urls: NormalizedCaptureUrl[] = []
          for (const item of library.items) {
            urls.push(yield* normalizeCaptureUrl(item.url))
          }

          const foldersByKey = new Map<string, LocalLibraryFolder>()
          for (const folder of library.folders) {
            const name = folder.name.trim()
            if (name.length === 0 || name.length > MAX_FOLDER_NAME_LENGTH) {
              return yield* new InvalidLocalLibraryFolderName({ name: folder.name })
            }
            if (!foldersByKey.has(folderKey(name))) {
              foldersByKey.set(folderKey(name), { name, emoji: folder.emoji, color: folder.color })
            }
          }

          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const folderIds = new Map<string, FolderId>()

              // Folders the request names are created first, so an item can be
              // filed into one in the same request.
              for (const [key, folder] of foldersByKey) {
                yield* tx
                  .insert(foldersTable)
                  .values({ userId, name: folder.name, emoji: folder.emoji, color: folder.color })
                  .onConflictDoNothing()
                const [row] = yield* tx
                  .select({ id: foldersTable.id })
                  .from(foldersTable)
                  .where(and(
                    eq(foldersTable.userId, userId),
                    sql`lower(${foldersTable.name}) = lower(${folder.name})`,
                  ))
                  .limit(1)
                if (row) folderIds.set(key, row.id)
              }

              // An item may name a Folder the Account has but the request does
              // not list. A name that matches neither leaves the item unfiled.
              const folderIdFor = (name: string | null) =>
                Effect.gen(function* () {
                  const trimmed = name?.trim()
                  if (!trimmed) return null
                  const key = folderKey(trimmed)
                  const known = folderIds.get(key)
                  if (known) return known
                  const [row] = yield* tx
                    .select({ id: foldersTable.id })
                    .from(foldersTable)
                    .where(and(
                      eq(foldersTable.userId, userId),
                      sql`lower(${foldersTable.name}) = ${key}`,
                    ))
                    .limit(1)
                  if (row) folderIds.set(key, row.id)
                  return row?.id ?? null
                })

              // The Link for a URL. A Link the server knows keeps its own Link
              // Metadata and Link Enrichment, which other Accounts share. Only a
              // new Link takes what the device found.
              const linkFor = (url: NormalizedCaptureUrl, item: LocalLibraryItem) =>
                Effect.gen(function* () {
                  const [known] = yield* tx
                    .select({ id: linksTable.id })
                    .from(linksTable)
                    .where(eq(linksTable.normalizedUrl, url.normalizedUrl))
                    .limit(1)
                  if (known) return known.id

                  const [created] = yield* tx
                    .insert(linksTable)
                    .values({
                      originalUrl: url.originalUrl,
                      normalizedUrl: url.normalizedUrl,
                      host: url.host,
                    })
                    .onConflictDoNothing()
                    .returning({ id: linksTable.id })

                  // A capture of the same URL created the Link first: use it as
                  // a Link the server already knew.
                  if (!created) {
                    const [raced] = yield* tx
                      .select({ id: linksTable.id })
                      .from(linksTable)
                      .where(eq(linksTable.normalizedUrl, url.normalizedUrl))
                      .limit(1)
                    if (!raced) throw new Error("Link insert conflicted but no Link was found.")
                    return raced.id
                  }

                  yield* tx.insert(linkMetadataTable).values({
                    linkId: created.id,
                    title: text(item.title),
                    description: text(item.description),
                    siteName: text(item.siteName),
                    faviconUrl: text(item.faviconUrl),
                  })
                  // Enrichment Status has no "finished without a summary", so a
                  // Link the device enriched is enriched whatever it found.
                  yield* tx.insert(linkEnrichmentTable).values({
                    linkId: created.id,
                    type: url.type,
                    tags: toTags(item.tags),
                    previewSummary: text(item.previewSummary),
                    status: "enriched",
                    enrichedAt: new Date(),
                  })
                  return created.id
                })

              const savedItemIds: SavedItemId[] = []

              for (const [index, item] of library.items.entries()) {
                const url = urls[index]!
                const folderId = yield* folderIdFor(item.folderName)

                const linkId = yield* linkFor(url, item)
                const [existing] = yield* tx
                  .select()
                  .from(savedItemsTable)
                  .where(and(eq(savedItemsTable.userId, userId), eq(savedItemsTable.linkId, linkId)))
                  .limit(1)

                if (existing) {
                  const isRead = existing.isRead || item.isRead
                  const fileIt = existing.folderId === null && folderId !== null
                  if (isRead !== existing.isRead || fileIt) {
                    yield* tx
                      .update(savedItemsTable)
                      .set({
                        isRead,
                        ...(fileIt ? { folderId } : {}),
                        updatedAt: new Date(),
                      })
                      .where(eq(savedItemsTable.id, existing.id))
                  }
                  savedItemIds.push(existing.id)
                  continue
                }

                const [created] = yield* tx
                  .insert(savedItemsTable)
                  .values({
                    userId,
                    linkId,
                    folderId,
                    captureChannel: "ios-app",
                    tags: [],
                    isRead: item.isRead,
                    createdAt: item.savedAt,
                    lastSavedAt: item.savedAt,
                  })
                  .returning({ id: savedItemsTable.id })
                if (!created) throw new Error("SavedItem insert did not return a row.")
                savedItemIds.push(created.id)
              }

              if (savedItemIds.length === 0) return [] as SavedItemWithLink[]

              const rows = yield* tx
                .select({
                  savedItem: savedItemsTable,
                  link: linksTable,
                  metadata: linkMetadataTable,
                  enrichment: linkEnrichmentTable,
                  source: sourcesTable,
                  folder: foldersTable,
                })
                .from(savedItemsTable)
                .innerJoin(linksTable, eq(savedItemsTable.linkId, linksTable.id))
                .innerJoin(linkMetadataTable, eq(linksTable.id, linkMetadataTable.linkId))
                .innerJoin(linkEnrichmentTable, eq(linksTable.id, linkEnrichmentTable.linkId))
                .leftJoin(sourcesTable, eq(savedItemsTable.sourceId, sourcesTable.id))
                .leftJoin(foldersTable, eq(savedItemsTable.folderId, foldersTable.id))
                .where(inArray(savedItemsTable.id, [...new Set(savedItemIds)]))

              const byId = new Map(rows.map((row) => [
                row.savedItem.id,
                toSavedItemWithLink(row.savedItem, row.link, row.metadata, row.enrichment, row.source, row.folder),
              ]))

              // One per imported item, in request order. Two items with the
              // same Normalized URL answer with the same Saved Item.
              return savedItemIds.map((id) => byId.get(id)!)
            }),
          )
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(LocalLibraryImport, LocalLibraryImport.make)

  static readonly defaultLayer = LocalLibraryImport.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
  )
}

export type LocalLibraryImportError = InvalidUrl | InvalidLocalLibraryFolderName
