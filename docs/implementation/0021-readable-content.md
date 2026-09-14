# Readable Content and the Reader View Implementation Guide

This document turns [ADR 0021](../adr/0021-readable-content-and-reader-view.md) into a delivery plan. Nothing is built yet. Slices are dependency-ordered: the API owns extraction and storage before any client can render it, which is the same ordering [ADR 0014](../adr/0014-folder-organization-and-api-scopes.md) used for Folders.

## Principles

- **One gate, one artifact.** The readability check decides, and a rejected page stores nothing. Shiori clears its text column but leaves its HTML column populated, so a bookmark reports no content while its readable endpoint still returns markup. There is no state here where the flag and the row disagree.
- **Two stored forms, one served.** `link_content` keeps the extractor's article HTML and the Markdown converted from it. The Reader View renders and search indexes the Markdown. Nothing serves the HTML, so no client sanitizes third-party markup in v1.
- **The flag is not in the body table.** `link_enrichment.has_readable_content` answers "is there a Reader View" for a list read, so retrieval never joins `link_content`.
- **Extraction is best effort.** It is an **Enrichment Job** stage that skips rather than fails, so a Link that yields no prose stays exactly as usable as one saved before this existed.
- **Cheap path first.** Readability runs against the `linkedom` document the fetch path already builds. Cloudflare is the escalation for pages the existing low-confidence signal already flagged, and it is called with the page markup rather than the URL.

## Slice 1 — extraction and storage — delivered

No user-visible surface. Delivered behind the existing enrichment pipeline.

| Task | Detail |
| --- | --- |
| Dependencies | `@mozilla/readability` and an HTML-to-Markdown converter in `apps/api`. `linkedom` is already present and is the document source. |
| Schema | `linkContentTable` in [schema.ts](../../apps/api/src/modules/persistence/schema.ts): `link_id` PK referencing `links` with cascade delete, `html`, `markdown`, a generated `tsvector` over `markdown` with a GIN index, `source`, `extracted_at`. Register it in `relationalSchema`, `relations`, and the `schema` export. |
| Schema | `has_readable_content` boolean on `linkEnrichmentTable`, default false. |
| Migration | `bun run db:generate`, then review the generated SQL — the generated column and GIN index are the parts drizzle-kit is least likely to get right unaided. |
| Extractor | New `apps/api/src/modules/content/ReadableContentExtractor.ts`. Runs the readability check against a parsed document, then extracts from a **second, fresh** document because Readability mutates the tree it is given. Sets a node-count cap. |
| Cloudflare | A sibling service to `CloudflareBrowserFetcher`, reusing its `AppConfig` values, calling `/browser-rendering/markdown` with `html` when the markup is in hand and `url` only when it is not. It returns Markdown, not a `PageDocument`, so it is not a `PageFetcher` tier. |
| Repository | `LinkContentRepository` with an upsert and a Markdown-only read. The read names its columns explicitly and never selects `html`. |
| Workflow | A `readable-content` stage in [EnrichmentWorkflow](../../apps/api/src/modules/enrichment/EnrichmentWorkflow.ts), before the AI call. Add the stage name to `EnrichmentStageResult["stage"]` in `domain/EnrichmentJob.ts`. |
| AI input | `MetadataFetcher.extractContent` takes the head of the stored Markdown when there is any, and falls back to the existing `extractPageContent` heuristic when there is not. `PAGE_CONTENT_LIMIT` stays 2000. |

### Values decided during implementation

- **Size caps**: 1,000,000 characters of article HTML, 250,000 of Markdown. A page over either ceiling stores nothing, because truncating the HTML would cut it mid-tag and break the re-conversion the column exists for.
- **Node-count cap**: 20,000 elements, checked by the gate before the parse. `linkedom`'s `getElementsByTagName` does not take the `*` wildcard — it answers zero, which would disable the cap silently — so the count comes from `querySelectorAll("*")`.
- **Character floor**: 500 characters of article text, enforced by the extractor. Readability's own `charThreshold` only decides whether to retry with looser flags; when the retries run out it returns the best attempt whatever its length, so passing it alone does not make the floor a rule.
- **`source` is an enum**, `readable_content_source`, matching the `link_type` and `enrichment_status` precedent.
- **Base URL injection**: `linkedom` gives a parsed string no `baseURI`, so Readability leaves every image and link relative. The extractor defines `baseURI` and `documentURI` on the document before the parse.

### Corrections to the ADR, recorded there and in CONTEXT.md

- The HTML column is nullable. Cloudflare returns Markdown and no article HTML, so a row from that source has no local form to re-convert.
- The escalation condition narrowed, from "the low-confidence signal already flagged the page" to "local extraction rejected a page that still carries the character floor of visible prose". The low-confidence signal fires on a bot wall, and `PageFetcher` has already escalated those before enrichment sees them.

### Testing seams

- The extractor takes HTML and returns an optional pair, so its whole surface is table-testable from fixture pages without a network or a database.
- The check and the extraction are separate calls, so "check rejects, nothing stored" is a direct assertion rather than an inference from a flag.
- The Cloudflare service is already the shape `CloudflareBrowserFetcher` uses — unconfigured returns `Option.none`, so the disabled path needs no mock.
- `EnrichmentWorkflow` already records stage results, so "skipped, and the job still succeeds" is asserted the way the existing tagging and preview-summary skips are.

### Known limitations, accepted

- Existing Links are not backfilled. Readable Content is written once, on the next enrichment a Link receives.
- The search index is created and never read in this slice.

## Slice 2 — the read endpoint and the contract

| Task | Detail |
| --- | --- |
| Contract | `SavedItemDto` gains `hasReadableContent`. Additive, so older clients ignore it — verify the iOS decoder tolerates unknown-to-it fields before relying on that. |
| Contract | A new response class carrying the Markdown, the extraction time, and the Original URL. |
| Endpoint | `GET /v1/saved-items/:id/content` on `savedItemsGroup`, scoped `saved-items:read` in the operation scope map, erroring with `SavedItemNotFoundError` for a Link with no content so absence and non-ownership are indistinguishable. |
| Raycast | The pre-commit hook regenerates the vendored contract. A fresh worktree needs both a root `bun install` and `npm ci` in `apps/raycast-plugin`, or the hook rewrites the vendored contract to `any` and stages it. |
| Public profiles | `PublicSavedItemDto` is an allow-list, so nothing leaks by default. Add a regression test that asserts it, because the protection is a convention until something checks it. |

## Slice 3 — Reader View on iOS

Opening a Saved Item with Readable Content pushes the Reader View and marks it read through the existing **Open Action**. Opening one without it keeps today's behavior and goes to the browser. The Reader View always offers the Original URL. Markdown rendering needs a block-level renderer; `AttributedString(markdown:)` handles inline formatting only and will not render headings, lists, or code blocks.

## Slice 4 — Reader View on the Web Companion

The same routing, under the keyboard-first model of [ADR 0010](../adr/0010-keyboard-driven-web-companion.md).

## Open follow-ups

- **Search over Readable Content.** The index exists from Slice 1. Turning it on is a product decision about whether an article's body ranks beside its title, for the **Search Tab** and the **Command Palette** alike.
  Before it is turned on, the indexed expression needs revisiting: Markdown link targets become lexemes, so an MDN page indexes terms like `'/en-us/docs/web/css/reference'`. Indexing Markdown instead of HTML avoided tag names becoming terms, and this is the same leak by another route. The fix belongs in the generated column's expression, which means a migration, so it is worth deciding before any query depends on the current shape.
- **Backfill.** Extracting for Links saved before this shipped is an operational job, and some of those pages will already be gone.
- **Serving the HTML form.** Requires an HTML sanitizer on both clients. The stored column exists so this stays possible; nothing depends on it.
- **Re-conversion.** The reason the HTML is kept. A better Markdown converter can be run against every stored Link without a network call.
