import { eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import type { UserId } from "../../domain/SavedItem.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import { accountSettingsTable } from "../persistence/schema.js"

export type AccountSettings = {
  readonly autoFiling: boolean
}

export type AccountSettingsChange = { readonly [K in keyof AccountSettings]?: boolean | undefined }

/// What an Account without a row reads as: the settings a new Account starts
/// with. Accounts that existed before a setting shipped have a row that says
/// otherwise, written by the migration that added it.
const DEFAULTS: AccountSettings = {
  autoFiling: true,
}

export class AccountSettingsRepository extends Context.Service<AccountSettingsRepository>()(
  "@app/modules/settings/AccountSettingsRepository",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      const findByUser = Effect.fn("AccountSettingsRepository.findByUser")(function* (userId: UserId) {
        const [row] = yield* db
          .select()
          .from(accountSettingsTable)
          .where(eq(accountSettingsTable.userId, userId))
          .limit(1)
        return row ? { autoFiling: row.autoFiling } : DEFAULTS
      })

      return {
        findByUser,

        // A setting that is left out keeps its value. The row is created by
        // the first change, from the defaults.
        update: Effect.fn("AccountSettingsRepository.update")(function* (userId: UserId, change: AccountSettingsChange) {
          if (change.autoFiling === undefined) return yield* findByUser(userId)

          const now = new Date()
          const [row] = yield* db
            .insert(accountSettingsTable)
            .values({ userId, autoFiling: change.autoFiling, updatedAt: now })
            .onConflictDoUpdate({
              target: accountSettingsTable.userId,
              set: { autoFiling: change.autoFiling, updatedAt: now },
            })
            .returning()
          return row ? { autoFiling: row.autoFiling } : yield* findByUser(userId)
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(AccountSettingsRepository, AccountSettingsRepository.make)

  static readonly defaultLayer = AccountSettingsRepository.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
  )
}
