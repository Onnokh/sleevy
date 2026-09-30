# ADR 0023: Local hybrid search over Content Passages

## Status

Accepted

## Context

Sleevy needs to retrieve relevant parts of saved Readable Content for contextual questions. Exact terms remain useful for names and quoted phrases, while semantic retrieval handles questions that use different words from the source. Sending every article to a paid embedding API is unnecessary for the current collection and adds a new data processor.

Links and Readable Content are shared across Accounts, but retrieval authorization belongs to each Account's Saved Items.

## Decision

Derive bounded, heading-aware Content Passages from Readable Content Markdown. Store their English full-text vectors and 1024-dimensional embeddings in Postgres with pgvector. Generate embeddings locally with `qwen3-embedding:0.6b` through Ollama, constrained to two CPUs, 1.5 GiB of memory, and one parallel request.

A background worker indexes one Link at a time. Readable Content updates mark that Link pending; successful replacement of all passages and the indexed timestamp is transactional. Failures are recorded for explicit retry and do not affect capture or Reader View.

Search always scopes candidates by joining Content Passages through the requesting Account's Saved Items. It combines Postgres full-text rank and cosine similarity with reciprocal-rank fusion, returning at most two passages per Saved Item. If the local embedding service is unavailable, keyword retrieval still answers.

The MCP server exposes this retrieval through `search_saved_content` under the existing `saved-items:read` scope. It returns excerpts and original URLs; the calling agent writes the answer and cites those sources, so Sleevy does not need another language model or a second question-answering endpoint.

Postgres uses exact cosine scans initially. The expected passage count is small enough that an approximate vector index would add operational and filtered-query complexity without a useful latency gain.

## Consequences

The deployment adds one local Ollama service and builds pgvector 0.8.1 into the existing Postgres 17 Alpine base. Keeping Alpine preserves the production database's musl locale behavior and avoids changing text index ordering by switching to Debian. The existing Postgres data volume remains the source of truth. Content Passages are disposable derived data and can be rebuilt with the backfill command.

Changing embedding dimensions requires a migration and full rebuild. Changing only the model requires a rebuild so queries and passages use the same model.

Content Passages target 1200 characters with a hard limit of 1600. Embedding requests explicitly set Ollama's batch size to 512 and context to 1024 tokens. The default batch of 2048 causes the model process to exceed the 1.5 GiB limit on production, even for ordinary passages; limiting only parallel requests does not bound that memory allocation. Background passage requests allow at least 60 seconds for CPU processing; query requests retain the configured timeout.
