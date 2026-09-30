import { describe, expect, test } from "bun:test"
import { Effect, Layer, Option } from "effect"

import type { FolderId, Link } from "../../src/domain/SavedItem.js"
import { JevClassifier, type FilingCandidate } from "../../src/modules/ai/JevClassifier.js"
import {
  TypeSafeClient,
  type TypeSafeAnswers,
  type TypeSafeQuestion,
} from "../../src/modules/ai/TypeSafeClient.js"

type Asked = { readonly state: unknown; readonly questions: Readonly<Record<string, TypeSafeQuestion>> }

const run = <A>(
  answer: (asked: Asked) => TypeSafeAnswers,
  use: (jev: JevClassifier["Service"]) => Effect.Effect<A, unknown>,
  asked: Asked[] = [],
) =>
  Effect.runPromise(
    Effect.flatMap(JevClassifier, use).pipe(
      Effect.provide(JevClassifier.layer.pipe(
        Layer.provide(Layer.succeed(TypeSafeClient, TypeSafeClient.of({
          enabled: true,
          ask: (state, questions) =>
            Effect.sync(() => {
              asked.push({ state, questions })
              return answer({ state, questions })
            }),
        }))),
      )),
    ) as Effect.Effect<A>,
  )

const link = { originalUrl: "https://bun.sh/blog/bun-v1.2", host: "bun.sh" } as Link

const folders: FilingCandidate[] = [
  { id: "f-rust" as FolderId, name: "Rust", examples: ["Tokio tutorial"] },
  { id: "f-none" as FolderId, name: "(none of these folders)", examples: [] },
]

const subject = {
  url: "https://github.com/tokio-rs/axum",
  title: "tokio-rs/axum",
  description: null,
  siteName: null,
  previewSummary: null,
  tags: [],
}

const choice = (pick: string, confidence: number): TypeSafeAnswers => ({
  folder: { type: "choice", choice: pick, confidence, probabilities: { [pick]: confidence } },
})

describe("JevClassifier", () => {
  test("keeps every Tag Jev puts at even odds or better, in vocabulary order", async () => {
    const tags = await run(
      () => ({
        ai: { type: "noul", noul: 0.02 },
        tools: { type: "noul", noul: 0.91 },
        typescript: { type: "noul", noul: 0.5 },
        security: { type: "noul", noul: 0.49 },
        design: { type: "noul", noul: 0.03 },
        backend: { type: "noul", noul: 0.79 },
        "front-end": { type: "noul", noul: 0.07 },
      }),
      (jev) => jev.tags({ link, metadata: Option.none(), content: Option.none() }),
    )

    expect(tags).toEqual(Option.some(["tools", "typescript", "backend"]))
  })

  test("reads no Tag at all as none", async () => {
    const tags = await run(
      ({ questions }) => Object.fromEntries(Object.keys(questions).map((key) => [key, { type: "noul", noul: 0.1 }])),
      (jev) => jev.tags({ link, metadata: Option.none(), content: Option.none() }),
    )

    expect(tags).toEqual(Option.none())
  })

  test("files only into a Folder chosen with confidence, and shows Jev what each Folder holds", async () => {
    const asked: Asked[] = []
    const sure = await run(() => choice("Rust", 0.98), (jev) => jev.folder(subject, folders), asked)
    const unsure = await run(() => choice("Rust", 0.6), (jev) => jev.folder(subject, folders))

    expect(sure).toEqual(Option.some("f-rust" as FolderId))
    expect(unsure).toEqual(Option.none())
    const criteria = (asked[0]?.questions.folder as { criteria: Record<string, unknown> }).criteria
    expect(criteria["Rust"]).toEqual({ already_filed_here: ["Tokio tutorial"] })
  })

  test("keeps the none option apart from a Folder that shares its name", async () => {
    const asked: Asked[] = []
    const answer = await run(
      ({ questions }) => {
        const options = Object.keys((questions.folder as { criteria: Record<string, unknown> }).criteria)
        return choice(options[options.length - 1]!, 0.99)
      },
      (jev) => jev.folder(subject, folders),
      asked,
    )

    expect(answer).toEqual(Option.none())
    const options = Object.keys((asked[0]?.questions.folder as { criteria: Record<string, unknown> }).criteria)
    expect(options).toEqual(["Rust", "(none of these folders)", "((none of these folders))"])
  })

  test("asks nothing for an Account without Folders", async () => {
    const asked: Asked[] = []
    const answer = await run(() => ({}), (jev) => jev.folder(subject, []), asked)

    expect(answer).toEqual(Option.none())
    expect(asked).toHaveLength(0)
  })
})
