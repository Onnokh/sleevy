import { Context, Effect, Layer, Schema } from "effect"

import { AppConfig } from "../../runtime/Config.js"
import { generateOpenAiObject } from "./AiEnricher.js"

/** The colours a Folder may take; the same set the product apps offer. */
export const FOLDER_COLORS = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "neutral"] as const

/** The most new Folders one Organize batch may propose. */
export const MAX_PROPOSED_FOLDERS = 5

export type ExistingFolder = {
  readonly name: string
  readonly emoji: string | null
  readonly color: string | null
  /** Titles of Saved Items already in the Folder, newest first. */
  readonly examples: readonly string[]
}

export type UnfiledLink = {
  /** A short key the model answers with; never shown to the person. */
  readonly key: string
  readonly title: string | null
  readonly host: string
  readonly previewSummary: string | null
  readonly tags: readonly string[]
}

export type ProposedFolder = {
  readonly name: string
  readonly emoji: string | null
  readonly color: string | null
  /** Keys of the unfiled links the model grouped under this Folder. */
  readonly keys: readonly string[]
}

const proposalSchema = Schema.Struct({
  folders: Schema.Array(Schema.Struct({
    name: Schema.String,
    emoji: Schema.NullOr(Schema.String),
    color: Schema.NullOr(Schema.Literals(FOLDER_COLORS)),
    links: Schema.Array(Schema.String),
  })),
})

export const folderProposalSystemPrompt = [
  "You suggest new folders for the unfiled links in a person's read-later app.",
  "",
  "You get the person's existing folders, each with a few titles already filed there, and a batch of unfiled links, each with a key.",
  "",
  "The existing folders are the person's own scheme. New folders must look like they were made by the same person:",
  "- Match the naming style: length, capitalisation, language, singular or plural, and how broad or narrow the folders are.",
  "- Give an emoji only when most existing folders have one, and then in the same spirit. Otherwise use null.",
  "- Give a colour only when most existing folders have one. Otherwise use null.",
  "- When the person has no folders yet, use short, broad names of one or two words in Title Case, with no emoji and no colour.",
  "",
  "Rules:",
  `- Suggest at most ${MAX_PROPOSED_FOLDERS} folders. Suggesting none is a good answer when the links are too mixed.`,
  "- Only suggest a folder for a clear group of at least three links that no existing folder already covers.",
  "- Never suggest a folder that repeats, renames, or overlaps an existing folder. A link that fits an existing folder is not your concern.",
  "- Name the subject, not the format. Avoid names such as \"Articles\", \"Links\", \"Misc\", \"Other\", \"To read\", or \"Interesting\".",
  "- List the keys of the links that belong in each folder you suggest.",
].join("\n")

const promptText = (existing: readonly ExistingFolder[], links: readonly UnfiledLink[]) => {
  const parts: string[] = ["Existing folders:"]
  if (existing.length === 0) parts.push("(none)")
  for (const folder of existing) {
    const style = [folder.emoji ? `emoji ${folder.emoji}` : null, folder.color ? `colour ${folder.color}` : null]
      .filter(Boolean)
      .join(", ")
    parts.push(`- ${folder.name}${style ? ` (${style})` : ""}`)
    for (const title of folder.examples) parts.push(`    · ${title}`)
  }

  parts.push("", "Unfiled links:")
  for (const link of links) {
    const details = [link.host, link.tags.length > 0 ? `tags: ${link.tags.join(", ")}` : null]
      .filter(Boolean)
      .join("; ")
    parts.push(`[${link.key}] ${link.title ?? "(untitled)"} (${details})`)
    if (link.previewSummary) parts.push(`    ${link.previewSummary}`)
  }

  return parts.join("\n")
}

/**
 * Suggests new Folders for a batch of unfiled Saved Items, in the style of the
 * Folders the person already made. This is the writing half of Organize: Jev
 * cannot name a Folder, so a language model proposes the names, and Jev then
 * decides which Saved Item goes where. Proposes nothing when AI is disabled.
 */
export class FolderProposer extends Context.Service<FolderProposer>()(
  "@app/modules/ai/FolderProposer",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig
      const enabled = config.ai.enabled && Boolean(config.ai.apiKey)
      const apiKey = config.ai.apiKey ?? ""
      const model = config.ai.model ?? "gpt-5.4-nano"

      return {
        enabled,

        propose: Effect.fn("FolderProposer.propose")(function* (
          existing: readonly ExistingFolder[],
          links: readonly UnfiledLink[],
        ) {
          if (!enabled || links.length === 0) return [] as readonly ProposedFolder[]

          const value = yield* generateOpenAiObject({
            apiKey,
            model,
            objectName: "folder_proposals",
            schema: proposalSchema,
            system: folderProposalSystemPrompt,
            prompt: promptText(existing, links),
            operation: "proposeFolders",
          })

          const known = new Set(links.map((link) => link.key))
          const taken = new Set(existing.map((folder) => folder.name.trim().toLowerCase()))
          const proposals: ProposedFolder[] = []
          for (const folder of value.folders) {
            const name = folder.name.trim()
            // The model is told not to repeat a Folder, but a name the Account
            // already uses would fail to create, so it is dropped here too.
            if (name.length === 0 || name.length > 80 || taken.has(name.toLowerCase())) continue
            taken.add(name.toLowerCase())
            proposals.push({
              name,
              emoji: folder.emoji?.trim() || null,
              color: folder.color,
              keys: folder.links.filter((key) => known.has(key)),
            })
          }
          return proposals.slice(0, MAX_PROPOSED_FOLDERS) as readonly ProposedFolder[]
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(FolderProposer, FolderProposer.make)

  static readonly defaultLayer = FolderProposer.layer.pipe(
    Layer.provide(AppConfig.layer),
  )
}
