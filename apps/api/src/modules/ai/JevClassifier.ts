import { Context, Effect, Layer, Option } from "effect"
import type { Effect as EffectType } from "effect/Effect"

import { topics } from "@sleevy/contract"
import type { FolderId, Link, Topic } from "../../domain/SavedItem.js"
import type { Metadata } from "../metadata/MetadataFetcher.js"
import {
  TypeSafeClient,
  type TypeSafeChoiceAnswer,
  type TypeSafeError,
  type TypeSafeNoulAnswer,
  type TypeSafeQuestion,
} from "./TypeSafeClient.js"

/** What each Tag covers, for the one question Jev answers about it. */
const TAG_SCOPES: Readonly<Record<Topic, string>> = {
  ai: "artificial intelligence, machine learning, LLMs, agents, prompts, AI tools and platforms",
  tools: "developer tooling, CLIs, SDKs, libraries, package managers, build tools",
  typescript: "TypeScript, JavaScript, Node.js, Deno, Bun, React, frontend frameworks",
  security: "security, authentication, encryption, vulnerabilities, CVEs, OAuth",
  design: "visual design, UI/UX, typography, color, layout, Figma, graphic design",
  backend: "databases, servers, infrastructure, APIs, queues, DevOps, cloud",
  "front-end": "CSS, browser APIs, HTML, web components, accessibility, responsive design",
}

/**
 * A Tag applies when Jev puts it at even odds or better. Each Tag is its own
 * yes/no question rather than one Choice, because a link can be about several
 * subjects at once, and about none.
 */
const TAG_THRESHOLD = 0.5

/**
 * The share of the Choice a Folder needs before a Saved Item is filed in it.
 * Filing in the wrong Folder hides the item where the person will not look, so
 * the bar sits well above the winner merely being the likeliest. Tuned against
 * jev-1.13.0.
 */
const FOLDER_CONFIDENCE = 0.75

/** The most recent titles sent per Folder to show Jev what the Folder holds. */
export const FOLDER_EXAMPLE_LIMIT = 5

/** Jev takes at most 255 options per Choice, and one is kept for "none". */
const FOLDER_OPTION_LIMIT = 254

export type TagInput = {
  readonly link: Link
  readonly metadata: Option.Option<Metadata>
  /** Extracted Page Content, when the fetched document yielded any. */
  readonly content: Option.Option<string>
}

/** A saved link as Auto-Filing describes it to Jev. */
export type FilingSubject = {
  readonly url: string
  readonly title: string | null
  readonly description: string | null
  readonly siteName: string | null
  readonly previewSummary: string | null
  readonly tags: readonly Topic[]
}

/**
 * A Folder Jev may choose. The id is a FolderId for a Folder that exists, and
 * any caller-chosen key for a Folder that Organize only proposes so far.
 */
export type FilingCandidate<Id extends string = FolderId> = {
  readonly id: Id
  readonly name: string
  /** Titles of Saved Items already in the Folder, newest first. */
  readonly examples: readonly string[]
}

const tagState = (input: TagInput) => {
  const metadata = Option.getOrUndefined(input.metadata)
  return {
    url: input.link.originalUrl,
    host: input.link.host,
    ...(metadata?.title ? { title: metadata.title } : {}),
    ...(metadata?.description ? { description: metadata.description } : {}),
    ...(metadata?.siteName ? { site: metadata.siteName } : {}),
    ...(Option.isSome(input.content) ? { page_content: input.content.value } : {}),
  }
}

const filingState = (subject: FilingSubject) => ({
  saved_link: {
    url: subject.url,
    ...(subject.title ? { title: subject.title } : {}),
    ...(subject.description ? { description: subject.description } : {}),
    ...(subject.siteName ? { site: subject.siteName } : {}),
    ...(subject.previewSummary ? { summary: subject.previewSummary } : {}),
    ...(subject.tags.length > 0 ? { tags: subject.tags } : {}),
  },
})

// A user may name a Folder anything, including the words of the "none" option,
// so that option takes a label no Folder name already uses.
const noneOption = (names: ReadonlySet<string>) => {
  let label = "(none of these folders)"
  while (names.has(label)) label = `(${label})`
  return label
}

/**
 * The typed judgments Sleevy asks of Jev: which Tags fit a Link, and which of
 * an Account's own Folders a Saved Item belongs in. Both answer nothing when
 * TypeSafe is not configured.
 */
export class JevClassifier extends Context.Service<JevClassifier>()(
  "@app/modules/ai/JevClassifier",
  {
    make: Effect.gen(function* () {
      const client = yield* TypeSafeClient

      const folder = Effect.fn("JevClassifier.folder")(function* (
        subject: FilingSubject,
        candidates: readonly FilingCandidate<string>[],
      ) {
        if (!client.enabled || candidates.length === 0) return Option.none<string>()

        // Folder names are unique per Account ignoring case, so the exact
        // name is a safe option key and reads naturally to Jev.
        const byName = new Map(candidates.slice(0, FOLDER_OPTION_LIMIT).map((folder) => [folder.name, folder]))
        const none = noneOption(new Set(byName.keys()))
        const criteria: Record<string, unknown> = {}
        for (const [name, folder] of byName) {
          criteria[name] = folder.examples.length > 0 ? { already_filed_here: folder.examples } : null
        }
        criteria[none] = "No folder is a clear fit for this link"

        const answers = yield* client.ask(filingState(subject), {
          folder: {
            type: "choice",
            instructions: "Which of the user's folders is the clear home for `saved_link`?",
            criteria,
          },
        })

        const answer = answers.folder as TypeSafeChoiceAnswer | undefined
        if (!answer || answer.choice === none || answer.confidence < FOLDER_CONFIDENCE) {
          return Option.none<string>()
        }
        const chosen = byName.get(answer.choice)
        return chosen ? Option.some(chosen.id) : Option.none<string>()
      })

      return {
        enabled: client.enabled,

        tags: Effect.fn("JevClassifier.tags")(function* (input: TagInput) {
          if (!client.enabled) return Option.none<readonly Topic[]>()

          const questions: Record<string, TypeSafeQuestion> = {}
          for (const topic of topics) {
            questions[topic] = {
              type: "noul",
              instructions: {
                tag: topic,
                covers: TAG_SCOPES[topic],
                question: "Is the saved link mainly about `tag`, as described by `covers`?",
              },
            }
          }

          const answers = yield* client.ask(tagState(input), questions)
          const tags = topics.filter((topic) =>
            ((answers[topic] as TypeSafeNoulAnswer | undefined)?.noul ?? 0) >= TAG_THRESHOLD)

          return tags.length > 0 ? Option.some<readonly Topic[]>(tags) : Option.none<readonly Topic[]>()
        }),

        folder: <Id extends string>(subject: FilingSubject, candidates: readonly FilingCandidate<Id>[]) =>
          folder(subject, candidates) as EffectType<Option.Option<Id>, TypeSafeError>,
      }
    }),
  },
) {
  static readonly layer = Layer.effect(JevClassifier, JevClassifier.make)

  static readonly defaultLayer = JevClassifier.layer.pipe(
    Layer.provide(TypeSafeClient.defaultLayer),
  )
}
