# ADR 0025: Jev Content Check before Enrichment

## Status

Accepted. Amends ADR 0021 (Readable Content) and ADR 0024 (Jev Classifier).

## Context

On 2026-10-14 a new Account saved 68 links to adult video sites from the iOS app in 21 minutes. Enrichment fetched every page, stored its metadata, ran the readability check on it, and sent its text to TypeSafe and the language model provider for Tags and a Preview Summary. Some titles described hidden-camera and leaked private recordings.

The readability check only asks whether a page has article-shaped markup. It cannot tell a blog post from a video page with a long description, and it says nothing about what the page is.

## Decision

Ask the Jev Classifier two yes/no questions about each page, in one request, after Hard Metadata and before Readable Content and AI Enrichment. This is the Content Check.

- `readable`: is the page a blog post, article, essay, or documentation page that a person saves to read later? When no, Sleevy keeps no Readable Content. Tags and the Preview Summary still run, because a repository or a tool page is worth tagging.
- `explicit`: is the page pornographic or sexually explicit? When yes, Sleevy keeps no Readable Content and makes neither AI call, so the page text goes no further than Jev.
- Each answer holds at a probability of 0.5 or more. This has not yet been tuned against a sample of real saves.
- The Hard Metadata stays in both cases. The person who saved the link still sees its title.
- The check fails open. Without `TYPESAFE_API_KEY`, or when TypeSafe fails, Enrichment runs as before and the job records the stage as skipped or failed.

## Consequences

Every Enrichment Job makes one more TypeSafe request, before the other stages. The page text reaches TypeSafe for every Link, including explicit ones.

A TypeSafe outage lets explicit pages through to Readable Content and the language model, as before this ADR. Failing closed would stop the Reader View for every Link during the outage.

The Content Check does not refuse a save and does not remove anything already stored. Links enriched before it keep what they have.
