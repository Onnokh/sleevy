import { Context, Data, Duration, Effect, Layer, Schedule, Schema } from "effect"

import { AppConfig } from "../../runtime/Config.js"

export class TypeSafeError extends Data.TaggedError("TypeSafeError")<{
  readonly status?: number
  readonly cause: unknown
}> {}

/**
 * One question to Jev. Instructions and criteria may carry structure as well
 * as text: Jev reads the field names, so a question can name the data it is
 * about in backticks.
 */
export type TypeSafeQuestion =
  | {
    readonly type: "noul"
    readonly instructions: unknown
    readonly criteria?: { readonly true?: unknown; readonly false?: unknown }
  }
  | {
    readonly type: "choice"
    readonly instructions: unknown
    readonly criteria: Readonly<Record<string, unknown>>
  }

const NoulAnswer = Schema.Struct({
  type: Schema.Literal("noul"),
  noul: Schema.Number,
})

const ChoiceAnswer = Schema.Struct({
  type: Schema.Literal("choice"),
  choice: Schema.String,
  confidence: Schema.Number,
  probabilities: Schema.Record(Schema.String, Schema.Number),
})

const SystemOneResponse = Schema.Struct({
  model: Schema.String,
  answers: Schema.Record(Schema.String, Schema.Union([NoulAnswer, ChoiceAnswer])),
})

export type TypeSafeAnswers = (typeof SystemOneResponse.Type)["answers"]
export type TypeSafeNoulAnswer = typeof NoulAnswer.Type
export type TypeSafeChoiceAnswer = typeof ChoiceAnswer.Type

const ENDPOINT = "https://api.typesafe.ai/v1/systemone"

// 429 is the rate limit and 529 is TypeSafe being overloaded. Both ask for a
// retry after a short wait; every other failure would fail the same way again.
const isRetryable = (error: TypeSafeError) => error.status === 429 || error.status === 529

/**
 * The TypeSafe System One endpoint: a state and a map of typed questions in,
 * one typed answer per question out. Every question is answered on its own
 * against the same state, in one request.
 */
export class TypeSafeClient extends Context.Service<TypeSafeClient>()(
  "@app/modules/ai/TypeSafeClient",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig
      const { apiKey, model } = config.typesafe

      const ask = Effect.fn("TypeSafeClient.ask")(function* (
        state: unknown,
        questions: Readonly<Record<string, TypeSafeQuestion>>,
      ) {
        const response = yield* Effect.tryPromise({
          try: async (signal) => {
            const response = await fetch(ENDPOINT, {
              method: "POST",
              signal,
              headers: {
                authorization: `Bearer ${apiKey}`,
                "content-type": "application/json",
              },
              body: globalThis.JSON.stringify({ state, model, questions }),
            })
            if (!response.ok) {
              throw new TypeSafeError({
                status: response.status,
                cause: new Error(`TypeSafe request failed with ${response.status}: ${await response.text()}`),
              })
            }
            return (await response.json()) as unknown
          },
          catch: (cause) => cause instanceof TypeSafeError ? cause : new TypeSafeError({ cause }),
        }).pipe(
          Effect.timeout(Duration.seconds(15)),
          Effect.catchTag("TimeoutError", (cause) => Effect.fail(new TypeSafeError({ cause }))),
          Effect.retry({
            while: isRetryable,
            schedule: Schedule.exponential(Duration.millis(500)),
            times: 3,
          }),
          Effect.flatMap((body) =>
            Schema.decodeUnknownEffect(SystemOneResponse)(body).pipe(
              Effect.mapError((cause) => new TypeSafeError({ cause })),
            )),
        )

        yield* Effect.annotateCurrentSpan("model", response.model)
        return response.answers
      })

      return { enabled: apiKey.length > 0, ask }
    }),
  },
) {
  static readonly layer = Layer.effect(TypeSafeClient, TypeSafeClient.make)

  static readonly defaultLayer = TypeSafeClient.layer.pipe(
    Layer.provide(AppConfig.layer),
  )
}
