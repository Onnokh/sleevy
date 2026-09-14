import { Effect, Option } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import type { FolderId, SavedItemId } from "../domain/SavedItem.js"
import { LinkContentRepository } from "../modules/content/LinkContentRepository.js"
import { FolderRepository } from "../modules/folders/FolderRepository.js"
import { ProfileRepository } from "../modules/profiles/ProfileRepository.js"
import { PublicProfileCachePurger } from "../modules/profiles/PublicProfileCachePurger.js"
import {
  decodeSavedItemsCursor,
  encodeSavedItemsCursor,
  SavedItemRepository,
} from "../modules/saved-items/SavedItemRepository.js"
import { Analytics } from "../modules/analytics/Analytics.js"
import {
  CurrentUser,
  FolderNotFoundError,
  ReadableContentDto,
  SavedItemNotFoundError,
  SavedItemsResponse,
  savedItemToDto,
  sleevyApi,
} from "./ApiContract.js"
import { gated, gatedAny } from "./AuthMiddleware.js"

// The largest page the list endpoint will serve, matching the MCP tool's cap so
// the two surfaces cannot disagree about how much one call may return.
const MAX_PAGE_SIZE = 100

const setSavedItemReadState = (id: SavedItemId, isRead: boolean) =>
  Effect.gen(function* () {
    const repo = yield* SavedItemRepository
    const userId = yield* CurrentUser
    const item = yield* repo.findByUserAndId(userId, id).pipe(Effect.orDie)
    if (item._tag === "None") {
      return yield* new SavedItemNotFoundError({
        message: "Saved Item was not found.",
        savedItemId: id,
      })
    }
    const updated = yield* repo.setReadState(userId, id, isRead).pipe(Effect.orDie)
    if (updated._tag === "None") {
      return yield* new SavedItemNotFoundError({
        message: "Saved Item was not found.",
        savedItemId: id,
      })
    }
    return savedItemToDto(updated.value)
  })

const missingFolder = (id: string) => new FolderNotFoundError({
  message: "Folder was not found.",
  folderId: id,
})

export const savedItemsGroupLive = HttpApiBuilder.group(sleevyApi, "saved-items", (handlers) =>
  handlers
    .handle("list", gated("saved-items:read", ({ query }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const folders = yield* FolderRepository
        const userId = yield* CurrentUser
        let folderId: FolderId | null | undefined
        if (query.folder === "none") {
          folderId = null
        } else if (query.folder !== undefined) {
          const folder = yield* folders.findByUserAndId(userId, query.folder as FolderId).pipe(Effect.orDie)
          if (folder._tag === "None") return yield* missingFolder(query.folder)
          folderId = query.folder as FolderId
        }
        const sort = query.sort ?? "newest"

        // No `limit` means the caller wants the whole list, which is what every
        // client asked for before paging existed. Only an explicit `limit` opts
        // into a page, so adding this could not change an existing caller's
        // answer.
        if (query.limit === undefined) {
          const items = yield* repo.listByUser(userId, sort, folderId).pipe(Effect.orDie)
          return new SavedItemsResponse({ savedItems: items.map(savedItemToDto), nextCursor: null })
        }

        const limit = Math.min(Math.max(Math.trunc(query.limit), 1), MAX_PAGE_SIZE)
        // An unreadable cursor is treated as no cursor: it can only come from a
        // caller that built one itself or kept one across a shape change, and
        // restarting the list beats refusing it.
        const cursor = query.cursor === undefined
          ? undefined
          : Option.getOrUndefined(decodeSavedItemsCursor(query.cursor))

        const page = yield* repo
          .listPageByUser(userId, limit, cursor, sort, folderId)
          .pipe(Effect.orDie)

        return new SavedItemsResponse({
          savedItems: page.items.map(savedItemToDto),
          nextCursor: page.nextCursor === null ? null : encodeSavedItemsCursor(page.nextCursor),
        })
      }),
    ))
    // A Link with no Readable Content answers exactly what a Saved Item owned
    // by somebody else answers, so the response never tells a caller that an
    // item exists. Most Links are not articles, so this 404 is the ordinary
    // case rather than a fault.
    .handle("content", gated("saved-items:read", ({ params }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const contentRepo = yield* LinkContentRepository
        const userId = yield* CurrentUser

        const found = yield* repo.findByUserAndId(userId, params.id).pipe(
          Effect.orDie,
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeedNone,
              onSome: (item) =>
                contentRepo.findByLinkId(item.link.id).pipe(
                  Effect.orDie,
                  Effect.map(Option.map((content) => ({ item, content }))),
                ),
            }),
          ),
        )

        // One failure site for both misses: a Link with no Readable Content and
        // a Saved Item owned by somebody else are answered identically, so the
        // response never discloses that an item exists.
        if (Option.isNone(found)) {
          return yield* new SavedItemNotFoundError({
            message: "Saved Item was not found.",
            savedItemId: params.id,
          })
        }

        return new ReadableContentDto({
          savedItemId: found.value.item.savedItem.id,
          // The Reader View always offers the Original URL, because extraction
          // loses tables, embeds, and figure captions.
          originalUrl: found.value.item.link.originalUrl,
          title: found.value.item.metadata.title,
          markdown: found.value.content.markdown,
          extractedAt: found.value.content.extractedAt,
        })
      })))
    .handle("markOpened", gated("saved-items:write", ({ params }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const analytics = yield* Analytics
        const userId = yield* CurrentUser
        const item = yield* repo.findByUserAndId(userId, params.id).pipe(Effect.orDie)
        if (item._tag === "None") {
          return yield* new SavedItemNotFoundError({
            message: "Saved Item was not found.",
            savedItemId: params.id,
          })
        }
        const updated = yield* repo.setReadState(userId, params.id, true).pipe(Effect.orDie)
        if (updated._tag === "None") {
          return yield* new SavedItemNotFoundError({
            message: "Saved Item was not found.",
            savedItemId: params.id,
          })
        }
        yield* analytics
          .track({ name: "item_opened", userId })
          .pipe(Effect.forkDetach)
        return savedItemToDto(updated.value)
      }),
    ))
    .handle("markRead", gated("saved-items:write", ({ params }) => setSavedItemReadState(params.id, true)))
    .handle("markUnread", gated("saved-items:write", ({ params }) => setSavedItemReadState(params.id, false)))
    .handle("setReadState", gated("saved-items:write", ({ params, payload }) => setSavedItemReadState(params.id, payload.isRead)))
    .handle("setFolder", gated("saved-items:write", ({ params, payload }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const folders = yield* FolderRepository
        const profiles = yield* ProfileRepository
        const cachePurger = yield* PublicProfileCachePurger
        const analytics = yield* Analytics
        const userId = yield* CurrentUser
        const folderId = payload.folderId as FolderId | null

        if (folderId !== null) {
          const folder = yield* folders.findByUserAndId(userId, folderId).pipe(Effect.orDie)
          if (folder._tag === "None") return yield* missingFolder(folderId)
        }

        const updated = yield* repo.setFolder(userId, params.id, folderId).pipe(Effect.orDie)
        if (updated._tag === "None") {
          return yield* new SavedItemNotFoundError({
            message: "Saved Item was not found.",
            savedItemId: params.id,
          })
        }
        const profile = yield* profiles.findByUser(userId).pipe(Effect.orDie)
        if (profile._tag === "Some" && profile.value.visibility === "public") {
          yield* cachePurger.purge(profile.value.handle)
        }
        yield* analytics
          .track({
            name: "item_moved",
            userId,
            properties: { destination: folderId === null ? "none" : "folder" },
          })
          .pipe(Effect.forkDetach)
        return savedItemToDto(updated.value)
      }),
    ))
    .handle("setSource", gated("saved-items:write", ({ payload }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const userId = yield* CurrentUser
        yield* repo
          .moveItemsToSource(userId, payload.itemIds as ReadonlyArray<SavedItemId>, payload.sourceName)
          .pipe(Effect.orDie)
      }),
    ))
    // Accept either saved-items:write or the dedicated saved-items:delete scope.
    // Raycast tokens only carry :write, so this lets them delete without a plugin
    // republish, while explicit :delete grants keep working.
    .handle("remove", gatedAny(["saved-items:write", "saved-items:delete"], ({ params }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const analytics = yield* Analytics
        const userId = yield* CurrentUser
        yield* repo.deleteByUserAndId(userId, params.id).pipe(Effect.orDie)
        yield* Effect.logInfo("Deleted bookmark")
        yield* analytics
          .track({ name: "item_deleted", userId })
          .pipe(Effect.forkDetach)
      }),
    )),
)
