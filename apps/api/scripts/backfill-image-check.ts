// Runs the Image Check on Links that were enriched before it existed.
//
// Enrichment now checks every External Image URL in Link Metadata before it is
// stored (see src/modules/metadata/ImageCheck.ts): an address that resolves to
// an image is stored as the address it resolved to, an address whose image is
// gone is removed, and an address the check cannot judge is kept. Links
// enriched earlier still hold the addresses their page named on the day they
// were saved, and some of those now answer 404 or 410, or redirect. This script
// gives those Links the same check.
//
// Usage, from apps/api:
//
//   bun scripts/backfill-image-check.ts                    # dry run, writes nothing
//   bun scripts/backfill-image-check.ts --apply            # write the changes
//   bun scripts/backfill-image-check.ts --handle onno      # only the Links that Public Profile shows
//
// Deliberately narrow, because this runs against real Libraries:
//
//   * Only the five image columns of Link Metadata are written (image, Link
//     Author avatar, three favicon variants), and `updated_at` with them. A
//     title, a Preview Summary, Tags, and every Saved Item column are left
//     alone, and no Enrichment Job is recorded.
//   * A rate limit, a server error, or a timeout keeps the stored address. The
//     check removes an address only when the image host says the image is gone
//     or answers with a web page.
//   * Links are checked one after another, so one image host does not see a
//     burst of requests; inside one Link the addresses are checked side by side.
//
// Re-running is safe: a resolved address answers without a redirect the second
// time and is left as it is, a removed address is not checked again, and an
// address the check could not judge is simply tried again.
//
// A Public Profile response is cached for five minutes at the edge, so a change
// shows on the page within five minutes of the write.

import { drizzle } from "drizzle-orm/node-postgres"
import { and, eq, isNotNull, or, sql } from "drizzle-orm"
import { ManagedRuntime } from "effect"
import { Pool } from "pg"

import type { LinkId, UserId } from "../src/domain/SavedItem.js"
import {
  ImageCheck,
  LINK_IMAGE_FIELDS,
  type LinkImages,
} from "../src/modules/metadata/ImageCheck.js"
import { linkMetadataTable, profilesTable, savedItemsTable } from "../src/modules/persistence/schema.js"
import { publicSavedItemFilter } from "../src/modules/profiles/PublicSavedItems.js"

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const handleIndex = args.indexOf("--handle")
const handle = handleIndex >= 0 ? args[handleIndex + 1] : undefined
if (handleIndex >= 0 && !handle) throw new Error("--handle needs a Handle after it.")

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Run this from apps/api.")

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle({ client: pool })
const runtime = ManagedRuntime.make(ImageCheck.defaultLayer)

const toImages = (row: Record<(typeof LINK_IMAGE_FIELDS)[number], string | null>): LinkImages => ({
  imageUrl: row.imageUrl ?? undefined,
  authorAvatarUrl: row.authorAvatarUrl ?? undefined,
  faviconUrl: row.faviconUrl ?? undefined,
  faviconLightUrl: row.faviconLightUrl ?? undefined,
  faviconDarkUrl: row.faviconDarkUrl ?? undefined,
})

// The Links whose Saved Items one Public Profile shows, by the same filter the
// public routes use; or every Link with at least one image address.
const linkIdsForHandle = async (value: string) => {
  const [profile] = await db
    .select({ userId: profilesTable.userId })
    .from(profilesTable)
    .where(sql`lower(${profilesTable.handle}) = lower(${value})`)
    .limit(1)
  if (!profile) throw new Error(`No Public Profile has the Handle "${value}".`)

  const rows = await db
    .selectDistinct({ linkId: savedItemsTable.linkId })
    .from(savedItemsTable)
    .where(publicSavedItemFilter(profile.userId as UserId))
  return rows.map((row) => row.linkId)
}

const main = async () => {
  console.log(`Database: ${new URL(databaseUrl).hostname}`)
  console.log(apply ? "Mode: apply" : "Mode: dry run, nothing is written")
  console.log(handle ? `Scope: Public Profile ${handle}\n` : "Scope: every Link\n")

  const scope = handle ? new Set<string>(await linkIdsForHandle(handle)) : undefined

  const rows = (
    await db
      .select({
        linkId: linkMetadataTable.linkId,
        imageUrl: linkMetadataTable.imageUrl,
        authorAvatarUrl: linkMetadataTable.authorAvatarUrl,
        faviconUrl: linkMetadataTable.faviconUrl,
        faviconLightUrl: linkMetadataTable.faviconLightUrl,
        faviconDarkUrl: linkMetadataTable.faviconDarkUrl,
      })
      .from(linkMetadataTable)
      .where(
        or(
          isNotNull(linkMetadataTable.imageUrl),
          isNotNull(linkMetadataTable.authorAvatarUrl),
          isNotNull(linkMetadataTable.faviconUrl),
          isNotNull(linkMetadataTable.faviconLightUrl),
          isNotNull(linkMetadataTable.faviconDarkUrl),
        ),
      )
      .orderBy(linkMetadataTable.linkId)
  ).filter((row) => scope === undefined || scope.has(row.linkId))

  console.log(`${rows.length} Links with at least one image address\n`)

  let changedLinks = 0
  let resolved = 0
  let removed = 0

  for (const row of rows) {
    const before = toImages(row)
    const after = await runtime.runPromise(
      ImageCheck.use((check) => check.checkImages(before)),
    )

    const changes = LINK_IMAGE_FIELDS.filter((field) => before[field] !== after[field])
    if (changes.length === 0) continue

    changedLinks += 1
    console.log(`  link ${row.linkId}`)
    for (const field of changes) {
      if (after[field] === undefined) {
        removed += 1
        console.log(`    ${field}: remove ${before[field]}`)
      } else {
        resolved += 1
        console.log(`    ${field}: ${before[field]}\n      -> ${after[field]}`)
      }
    }

    if (!apply) continue

    // Only the changed columns, and only while they still hold the address
    // that was checked: an Enrichment Job that wrote a new one meanwhile wins.
    const set = Object.fromEntries(changes.map((field) => [field, after[field] ?? null]))
    await db
      .update(linkMetadataTable)
      .set({ ...set, updatedAt: new Date() })
      .where(
        and(
          eq(linkMetadataTable.linkId, row.linkId as LinkId),
          ...changes.map((field) => eq(linkMetadataTable[field], before[field] as string)),
        ),
      )
  }

  console.log()
  console.log(
    `${apply ? "Changed" : "Would change"} ${changedLinks} Links: ` +
    `${resolved} addresses resolved, ${removed} removed.` +
    (apply || changedLinks === 0 ? "" : " Re-run with --apply to write."),
  )
}

await main()
  .catch((cause) => {
    console.error(cause instanceof Error ? cause.message : cause)
    process.exitCode = 1
  })
  .finally(async () => {
    await runtime.dispose()
    await pool.end()
  })
