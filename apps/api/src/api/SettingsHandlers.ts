import { Effect, Schema } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import { Organizer, type OrganizeRun } from "../modules/organize/Organizer.js"
import { AccountSettingsRepository } from "../modules/settings/AccountSettingsRepository.js"
import {
  AccountSettingsDto,
  CurrentUser,
  OrganizeResultDto,
  OrganizeRunDto,
  OrganizeUnavailableError,
  sleevyApi,
} from "./ApiContract.js"

// The run carries its plan as plain data; decoding builds the nested plan,
// move and Folder classes the response encoder insists on.
export const toRunDto = (run: OrganizeRun) => Schema.decodeUnknownSync(OrganizeRunDto)(run)

export const settingsGroupLive = HttpApiBuilder.group(sleevyApi, "settings", (handlers) =>
  handlers
    .handle("get", () =>
      Effect.gen(function* () {
        const repo = yield* AccountSettingsRepository
        const userId = yield* CurrentUser
        return new AccountSettingsDto(yield* repo.findByUser(userId).pipe(Effect.orDie))
      }),
    )
    .handle("update", ({ payload }) =>
      Effect.gen(function* () {
        const repo = yield* AccountSettingsRepository
        const userId = yield* CurrentUser
        return new AccountSettingsDto(yield* repo.update(userId, payload).pipe(Effect.orDie))
      }),
    )
    .handle("getOrganize", () =>
      Effect.gen(function* () {
        const organizer = yield* Organizer
        const userId = yield* CurrentUser
        return toRunDto(yield* organizer.get(userId).pipe(Effect.orDie))
      }),
    )
    .handle("startOrganize", () =>
      Effect.gen(function* () {
        const organizer = yield* Organizer
        const userId = yield* CurrentUser
        if (!organizer.available) {
          return yield* new OrganizeUnavailableError({ message: "Organize is not available right now." })
        }
        return toRunDto(yield* organizer.start(userId).pipe(Effect.orDie))
      }),
    )
    .handle("discardOrganize", () =>
      Effect.gen(function* () {
        const organizer = yield* Organizer
        const userId = yield* CurrentUser
        return toRunDto(yield* organizer.discard(userId).pipe(Effect.orDie))
      }),
    )
    .handle("applyOrganize", ({ payload }) =>
      Effect.gen(function* () {
        const organizer = yield* Organizer
        const userId = yield* CurrentUser
        return new OrganizeResultDto(yield* organizer.apply(userId, payload).pipe(Effect.orDie))
      }),
    ),
)
