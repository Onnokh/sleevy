import { and, eq, isNull } from "drizzle-orm"
import { Context, Effect, Layer, Option } from "effect"

import type { FolderId, SavedItemId, UserId } from "../../domain/SavedItem.js"
import { Analytics } from "../analytics/Analytics.js"
import {
  FOLDER_EXAMPLE_LIMIT,
  JevClassifier,
  type FilingCandidate,
} from "../ai/JevClassifier.js"
import { FolderRepository } from "../folders/FolderRepository.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import { savedItemsTable } from "../persistence/schema.js"
import { ProfileRepository } from "../profiles/ProfileRepository.js"
import { PublicProfileCachePurger } from "../profiles/PublicProfileCachePurger.js"
import { SavedItemRepository } from "../saved-items/SavedItemRepository.js"
import { AccountSettingsRepository } from "../settings/AccountSettingsRepository.js"

export type AutoFilingOutcome =
  | { readonly _tag: "filed"; readonly folderId: FolderId }
  | { readonly _tag: "skipped"; readonly reason: "off" | "no-folders" | "already-filed" | "no-fit" | "missing" }

/**
 * Auto-Filing: puts a Saved Item that arrived without a Folder into the one
 * existing Folder of its Account that clearly fits it.
 *
 * It runs after Enrichment, so Jev sees the title, summary and Tags the person
 * sees. It only ever chooses among the Account's own Folders and never creates
 * one, and it leaves the item unfiled when no Folder is a clear fit. A Folder
 * the person set in the meantime always wins: the write only lands on an item
 * that is still unfiled.
 */
export class AutoFiling extends Context.Service<AutoFiling>()(
  "@app/modules/auto-filing/AutoFiling",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient
      const settings = yield* AccountSettingsRepository
      const folders = yield* FolderRepository
      const savedItems = yield* SavedItemRepository
      const jev = yield* JevClassifier
      const profiles = yield* ProfileRepository
      const cachePurger = yield* PublicProfileCachePurger
      const analytics = yield* Analytics

      const file = Effect.fn("AutoFiling.file")(function* (userId: UserId, savedItemId: SavedItemId) {
        yield* Effect.annotateCurrentSpan("savedItemId", savedItemId)

        if (!(yield* settings.findByUser(userId)).autoFiling) {
          return { _tag: "skipped", reason: "off" } satisfies AutoFilingOutcome
        }

        const accountFolders = yield* folders.listByUser(userId)
        if (accountFolders.length === 0) {
          return { _tag: "skipped", reason: "no-folders" } satisfies AutoFilingOutcome
        }

        const found = yield* savedItems.findByUserAndId(userId, savedItemId)
        if (Option.isNone(found)) {
          return { _tag: "skipped", reason: "missing" } satisfies AutoFilingOutcome
        }
        const item = found.value
        if (item.savedItem.folderId) {
          return { _tag: "skipped", reason: "already-filed" } satisfies AutoFilingOutcome
        }

        const examples = yield* folders.exampleTitles(userId, FOLDER_EXAMPLE_LIMIT)
        const candidates: FilingCandidate[] = accountFolders.map((folder) => ({
          id: folder.id,
          name: folder.name,
          examples: examples.get(folder.id) ?? [],
        }))

        const choice = yield* jev.folder(
          {
            url: item.link.originalUrl,
            title: item.metadata.title ?? null,
            description: item.metadata.description ?? null,
            siteName: item.metadata.siteName ?? null,
            previewSummary: item.enrichment.previewSummary ?? null,
            // The Effective Tags: the person's own when they gave any.
            tags: item.savedItem.tags.length > 0 ? item.savedItem.tags : item.enrichment.tags,
          },
          candidates,
        )
        if (Option.isNone(choice)) {
          return { _tag: "skipped", reason: "no-fit" } satisfies AutoFilingOutcome
        }

        const [filed] = yield* db
          .update(savedItemsTable)
          .set({ folderId: choice.value, updatedAt: new Date() })
          .where(and(
            eq(savedItemsTable.userId, userId),
            eq(savedItemsTable.id, savedItemId),
            isNull(savedItemsTable.folderId),
          ))
          .returning({ id: savedItemsTable.id })
        if (!filed) {
          return { _tag: "skipped", reason: "already-filed" } satisfies AutoFilingOutcome
        }

        const folder = accountFolders.find((candidate) => candidate.id === choice.value)
        if (folder?.isPublished) {
          const profile = yield* profiles.findByUser(userId)
          if (Option.isSome(profile) && profile.value.visibility === "public") {
            yield* cachePurger.purge(profile.value.handle)
          }
        }
        yield* analytics
          .track({ name: "item_auto_filed", userId })
          .pipe(Effect.forkDetach)

        return { _tag: "filed", folderId: choice.value } satisfies AutoFilingOutcome
      })

      return { file }
    }),
  },
) {
  static readonly layer = Layer.effect(AutoFiling, AutoFiling.make)

  static readonly defaultLayer = AutoFiling.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
    Layer.provide(AccountSettingsRepository.defaultLayer),
    Layer.provide(FolderRepository.defaultLayer),
    Layer.provide(SavedItemRepository.defaultLayer),
    Layer.provide(JevClassifier.defaultLayer),
    Layer.provide(ProfileRepository.defaultLayer),
    Layer.provide(PublicProfileCachePurger.defaultLayer),
    Layer.provide(Analytics.defaultLayer),
  )
}
