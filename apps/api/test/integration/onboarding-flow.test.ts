import { beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Effect } from "effect"
import { Pool } from "pg"

import type { UserId } from "../../src/domain/SavedItem.js"
import { OnboardingRepository } from "../../src/modules/onboarding/OnboardingRepository.js"
import {
  cleanTestDatabase,
  setupTestDatabase,
  testDatabaseUrl,
  withTestDatabaseUrl,
} from "../lib/postgres.js"

// No skip guard on purpose: keeping both of two changes made at once is a
// Postgres rule here, so a missing database must fail loudly.
const runIntegration = <A, E>(effect: Effect.Effect<A, E, OnboardingRepository>) =>
  withTestDatabaseUrl(() =>
    Effect.runPromise(effect.pipe(Effect.provide(OnboardingRepository.defaultLayer))),
  )

const withPool = async <A>(run: (pool: Pool) => Promise<A>) => {
  const pool = new Pool({ connectionString: testDatabaseUrl })
  try {
    return await run(pool)
  } finally {
    await pool.end()
  }
}

const insertUser = (userId: UserId) =>
  withPool((pool) =>
    pool.query(
      `
        insert into "user" (id, name, email, email_verified, created_at, updated_at)
        values ($1, $2, $3, true, now(), now())
      `,
      [userId, "Integration User", `${userId}@example.com`],
    ),
  )

const dismissedAt = (userId: UserId) =>
  withPool(async (pool) => {
    const result = await pool.query<{ getting_started_dismissed_at: Date | null }>(
      `select getting_started_dismissed_at from onboarding where user_id = $1`,
      [userId],
    )
    return result.rows[0]?.getting_started_dismissed_at ?? null
  })

const newUser = async () => {
  const userId = `integration-user-${randomUUID()}` as UserId
  await insertUser(userId)
  return userId
}

beforeAll(async () => {
  await setupTestDatabase()
})

beforeEach(async () => {
  await cleanTestDatabase()
})

describe("onboarding integration flow", () => {
  test("reads a new Account as having done nothing yet", async () => {
    const userId = await newUser()

    const onboarding = await runIntegration(
      Effect.gen(function* () {
        return yield* (yield* OnboardingRepository).findByUser(userId)
      }),
    )

    expect(onboarding).toEqual({
      gettingStartedDismissed: false,
      commandPaletteOpened: false,
      iphoneHandOffSeen: false,
      iphoneCardDismissed: false,
    })
  })

  test("changes only the flags it is given, and clears a flag set to false", async () => {
    const userId = await newUser()

    await runIntegration(
      Effect.gen(function* () {
        const repo = yield* OnboardingRepository

        const first = yield* repo.update(userId, { commandPaletteOpened: true })
        expect(first.commandPaletteOpened).toBe(true)
        expect(first.gettingStartedDismissed).toBe(false)

        const second = yield* repo.update(userId, { gettingStartedDismissed: true })
        // Left out, so it keeps its value.
        expect(second.commandPaletteOpened).toBe(true)
        expect(second.gettingStartedDismissed).toBe(true)

        // The way the Getting Started Card is brought back.
        const reopened = yield* repo.update(userId, { gettingStartedDismissed: false })
        expect(reopened.gettingStartedDismissed).toBe(false)
        expect(reopened.commandPaletteOpened).toBe(true)

        expect(yield* repo.findByUser(userId)).toEqual(reopened)
      }),
    )
  })

  test("keeps the time a flag first became true", async () => {
    const userId = await newUser()

    await runIntegration(
      Effect.gen(function* () {
        yield* (yield* OnboardingRepository).update(userId, { gettingStartedDismissed: true })
      }),
    )
    const first = await dismissedAt(userId)

    await Bun.sleep(20)
    await runIntegration(
      Effect.gen(function* () {
        yield* (yield* OnboardingRepository).update(userId, { gettingStartedDismissed: true })
      }),
    )

    expect(first).not.toBeNull()
    expect(await dismissedAt(userId)).toEqual(first)
  })

  test("keeps both of two changes to different flags made at the same moment", async () => {
    const userId = await newUser()

    const onboarding = await runIntegration(
      Effect.gen(function* () {
        const repo = yield* OnboardingRepository
        yield* Effect.all(
          [
            repo.update(userId, { iphoneHandOffSeen: true }),
            repo.update(userId, { iphoneCardDismissed: true }),
          ],
          { concurrency: "unbounded" },
        )
        return yield* repo.findByUser(userId)
      }),
    )

    expect(onboarding.iphoneHandOffSeen).toBe(true)
    expect(onboarding.iphoneCardDismissed).toBe(true)
  })
})
