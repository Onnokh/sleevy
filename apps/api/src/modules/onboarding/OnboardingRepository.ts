import { eq, sql, type SQL } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import type { UserId } from "../../domain/SavedItem.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import { onboardingTable } from "../persistence/schema.js"

/// What one Account has done with the Web Companion's first-run help, as
/// flags: each is true once the thing has happened.
export type Onboarding = {
  readonly gettingStartedDismissed: boolean
  readonly commandPaletteOpened: boolean
  readonly iphoneHandOffSeen: boolean
  readonly iphoneCardDismissed: boolean
}

export type OnboardingChange = { readonly [K in keyof Onboarding]?: boolean | undefined }

type Row = typeof onboardingTable.$inferSelect

const COLUMNS = {
  gettingStartedDismissed: "gettingStartedDismissedAt",
  commandPaletteOpened: "commandPaletteOpenedAt",
  iphoneHandOffSeen: "iphoneHandOffSeenAt",
  iphoneCardDismissed: "iphoneCardDismissedAt",
} as const satisfies Record<keyof Onboarding, keyof Row>

type Column = (typeof COLUMNS)[keyof Onboarding]

const FLAGS = Object.keys(COLUMNS) as readonly (keyof Onboarding)[]

const toOnboarding = (row: Row | undefined): Onboarding => ({
  gettingStartedDismissed: Boolean(row?.gettingStartedDismissedAt),
  commandPaletteOpened: Boolean(row?.commandPaletteOpenedAt),
  iphoneHandOffSeen: Boolean(row?.iphoneHandOffSeenAt),
  iphoneCardDismissed: Boolean(row?.iphoneCardDismissedAt),
})

export class OnboardingRepository extends Context.Service<OnboardingRepository>()(
  "@app/modules/onboarding/OnboardingRepository",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      const findByUser = Effect.fn("OnboardingRepository.findByUser")(function* (userId: UserId) {
        const [row] = yield* db
          .select()
          .from(onboardingTable)
          .where(eq(onboardingTable.userId, userId))
          .limit(1)
        // An Account that has recorded nothing yet has no row: all false.
        return toOnboarding(row)
      })

      return {
        findByUser,

        // One statement, so two clients recording different flags at the same
        // moment cannot lose either. The row is created by the first change.
        // A flag set to true keeps the time it first became true; a flag set
        // to false is cleared, which is how a Getting Started Card comes back.
        update: Effect.fn("OnboardingRepository.update")(function* (userId: UserId, change: OnboardingChange) {
          const now = new Date()
          const inserted: Partial<Record<Column, Date | null>> = {}
          const updated: Partial<Record<Column, SQL | null>> = {}

          for (const flag of FLAGS) {
            const value = change[flag]
            if (value === undefined) continue
            const column = COLUMNS[flag]
            inserted[column] = value ? now : null
            updated[column] = value ? sql`coalesce(${onboardingTable[column]}, ${now})` : null
          }

          if (Object.keys(updated).length === 0) return yield* findByUser(userId)

          const [row] = yield* db
            .insert(onboardingTable)
            .values({ userId, ...inserted, updatedAt: now })
            .onConflictDoUpdate({ target: onboardingTable.userId, set: { ...updated, updatedAt: now } })
            .returning()
          return toOnboarding(row)
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(OnboardingRepository, OnboardingRepository.make)

  static readonly defaultLayer = OnboardingRepository.layer.pipe(
    Layer.provide(PostgresClient.defaultLayer),
  )
}
