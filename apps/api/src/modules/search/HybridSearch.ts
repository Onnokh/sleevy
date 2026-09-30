import { Context, Effect, Layer, Result } from "effect"

import type { UserId } from "../../domain/SavedItem.js"
import { EmbeddingProvider } from "./EmbeddingProvider.js"
import { normalizeSearchPhrase } from "./SearchPhrase.js"
import {
  HybridSearchRepository,
  type SearchCandidate,
} from "./HybridSearchRepository.js"

export type HybridSearchMatch = "keyword" | "semantic" | "both"

export type HybridSearchResult = Omit<SearchCandidate, "score" | "content"> & {
  readonly excerpt: string
  readonly matchedBy: HybridSearchMatch
  readonly score: number
}

const RRF_K = 60
const CANDIDATE_MULTIPLIER = 4
const MAX_RESULTS_PER_ITEM = 2

export class HybridSearch extends Context.Service<HybridSearch>()(
  "@app/modules/search/HybridSearch",
  {
    make: Effect.gen(function* () {
      const repository = yield* HybridSearchRepository
      const embeddings = yield* EmbeddingProvider

      return {
        search: Effect.fn("HybridSearch.search")(function* (
          userId: UserId,
          rawQuery: string,
          requestedLimit = 10,
        ) {
          const query = rawQuery.trim()
          if (!query) return []
          const limit = Math.max(1, Math.min(requestedLimit, 50))
          const candidateLimit = limit * CANDIDATE_MULTIPLIER

          const keyword = yield* repository.keyword(userId, query, candidateLimit)
          let semantic: readonly SearchCandidate[] = []

          if (embeddings.enabled) {
            const semanticResult = yield* Effect.result(
              embeddings.embedQuery(query).pipe(
                Effect.flatMap((embedding) =>
                  repository.semantic(userId, embedding, embeddings.model, candidateLimit),
                ),
              ),
            )
            if (Result.isSuccess(semanticResult)) {
              semantic = semanticResult.success
            } else {
              yield* Effect.logWarning("semantic retrieval failed; returning keyword results", {
                cause: semanticResult.failure,
              })
            }
          }

          return fuseSearchCandidates(keyword, semantic, limit, query)
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(HybridSearch, HybridSearch.make)
  static readonly defaultLayer = HybridSearch.layer.pipe(
    Layer.provide(HybridSearchRepository.defaultLayer),
    Layer.provide(EmbeddingProvider.defaultLayer),
  )
}

export const fuseSearchCandidates = (
  keyword: readonly SearchCandidate[],
  semantic: readonly SearchCandidate[],
  limit: number,
  query: string,
): readonly HybridSearchResult[] => {
  type Accumulated = {
    readonly candidate: SearchCandidate
    score: number
    keyword: boolean
    semantic: boolean
    phraseMatch: boolean
  }
  const accumulated = new Map<string, Accumulated>()
  const phrase = normalizeSearchPhrase(query)

  const add = (candidates: readonly SearchCandidate[], kind: "keyword" | "semantic") => {
    candidates.forEach((candidate, index) => {
      const key = `${candidate.linkId}:${candidate.ordinal}`
      const current = accumulated.get(key) ?? {
        candidate,
        score: 0,
        keyword: false,
        semantic: false,
        phraseMatch: phrase.includes(" ") && [candidate.title ?? "", candidate.headingPath, candidate.content]
          .some((text) => ` ${normalizeSearchPhrase(text)} `.includes(` ${phrase} `)),
      }
      current.score += 1 / (RRF_K + index + 1)
      current[kind] = true
      accumulated.set(key, current)
    })
  }

  add(keyword, "keyword")
  add(semantic, "semantic")

  const perItem = new Map<string, number>()
  const results: HybridSearchResult[] = []
  for (const value of [...accumulated.values()].sort((a, b) =>
    Number(b.phraseMatch) - Number(a.phraseMatch) || b.score - a.score
  )) {
    const itemCount = perItem.get(value.candidate.savedItemId) ?? 0
    if (itemCount >= MAX_RESULTS_PER_ITEM) continue
    perItem.set(value.candidate.savedItemId, itemCount + 1)

    const { content, score: _sourceScore, ...candidate } = value.candidate
    results.push({
      ...candidate,
      excerpt: makeExcerpt(content),
      matchedBy: value.keyword && value.semantic
        ? "both"
        : value.keyword ? "keyword" : "semantic",
      score: value.score,
    })
    if (results.length === limit) break
  }
  return results
}

const makeExcerpt = (content: string): string => {
  const compact = content.replace(/\s+/g, " ").trim()
  return compact.length <= 700 ? compact : `${compact.slice(0, 697).trimEnd()}…`
}
