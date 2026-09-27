import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import { OnboardingRepository } from "../modules/onboarding/OnboardingRepository.js"
import { CurrentUser, OnboardingDto, sleevyApi } from "./ApiContract.js"

export const onboardingGroupLive = HttpApiBuilder.group(sleevyApi, "onboarding", (handlers) =>
  handlers
    .handle("get", () =>
      Effect.gen(function* () {
        const repo = yield* OnboardingRepository
        const userId = yield* CurrentUser
        return new OnboardingDto(yield* repo.findByUser(userId).pipe(Effect.orDie))
      }),
    )
    .handle("update", ({ payload }) =>
      Effect.gen(function* () {
        const repo = yield* OnboardingRepository
        const userId = yield* CurrentUser
        return new OnboardingDto(yield* repo.update(userId, payload).pipe(Effect.orDie))
      }),
    ),
)
