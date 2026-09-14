import { defineRelations, sql, type SQL } from "drizzle-orm"
import { randomUUID } from "node:crypto"

import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import {
  captureChannels,
  enrichmentStatuses,
  linkTypes,
  profileVisibilities,
} from "@sleevy/contract"
import type {
  CaptureChannel,
  EnrichmentStatus,
  LinkType,
  SavedItemId,
  SourceId,
  FolderId,
  LinkId,
  UserId,
} from "../../domain/SavedItem.js"
import type { ProfileId, ProfileVisibility } from "../../domain/Profile.js"
import type {
  EnrichmentJobId,
  EnrichmentJobStatus,
} from "../../domain/EnrichmentJob.js"
import {
  account,
  apikey,
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
  verification,
} from "./better-auth.generated.js"

export {
  account,
  apikey,
  jwks,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
  verification,
}

export const enrichmentStatusEnum = pgEnum("enrichment_status", enrichmentStatuses)

export const linkTypeEnum = pgEnum("link_type", linkTypes)

export const captureChannelEnum = pgEnum("capture_channel", captureChannels)

export const profileVisibilityEnum = pgEnum("profile_visibility", profileVisibilities)

export const enrichmentJobStatusEnum = pgEnum("enrichment_job_status", [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
])

export const linksTable = pgTable(
  "links",
  {
    id: text("id")
      .$type<LinkId>()
      .primaryKey()
      .$defaultFn(() => randomUUID() as LinkId),
    originalUrl: text("original_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    host: text("host").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("links_normalized_url_unique").on(table.normalizedUrl),
    index("links_host_idx").on(table.host),
  ],
)

export const linkMetadataTable = pgTable("link_metadata", {
  linkId: text("link_id")
    .$type<LinkId>()
    .primaryKey()
    .references(() => linksTable.id, { onDelete: "cascade" }),
  title: text("title"),
  description: text("description"),
  siteName: text("site_name"),
  faviconUrl: text("favicon_url"),
  faviconLightUrl: text("favicon_light_url"),
  faviconDarkUrl: text("favicon_dark_url"),
  imageUrl: text("image_url"),
  canonicalUrl: text("canonical_url"),
  authorName: text("author_name"),
  authorHandle: text("author_handle"),
  authorAvatarUrl: text("author_avatar_url"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const linkEnrichmentTable = pgTable(
  "link_enrichment",
  {
    linkId: text("link_id")
      .$type<LinkId>()
      .primaryKey()
      .references(() => linksTable.id, { onDelete: "cascade" }),
    previewSummary: text("preview_summary"),
    type: linkTypeEnum("type")
      .$type<LinkType>()
      .notNull()
      .default("website"),
    tags: text("tags").array().notNull().default([]),
    status: enrichmentStatusEnum("status")
      .$type<EnrichmentStatus>()
      .notNull()
      .default("pending"),
    // Whether the Link has Readable Content, so a Saved Item list read answers
    // "is there a Reader View" without joining link_content. Written by the
    // readable-content Enrichment stage, and never true without a stored row.
    hasReadableContent: boolean("has_readable_content").notNull().default(false),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("link_enrichment_type_idx").on(table.type),
    index("link_enrichment_status_idx").on(table.status),
  ],
)

// Postgres tsvector has no drizzle column type. The column is generated rather
// than written, so its shape only has to be right for the DDL.
const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
})

// Readable Content lives in its own table rather than on link_metadata: every
// list read joins that record per row, so a body column would be carried by
// every Library, Inbox, Folder View, and search read to serve a view that opens
// one item at a time (see ADR 0021).
export const linkContentTable = pgTable(
  "link_content",
  {
    linkId: text("link_id")
      .$type<LinkId>()
      .primaryKey()
      .references(() => linksTable.id, { onDelete: "cascade" }),
    // The extractor's own article HTML. Stored and never served, so no client
    // sanitizes third-party markup in v1. It is kept so a better Markdown
    // conversion can be run later without fetching the page again.
    html: text("html").notNull(),
    // What the Reader View renders and what the search index reads.
    markdown: text("markdown").notNull(),
    // Indexed from the start and read by nothing in v1: the column cannot be
    // added later without rewriting the table, while the query can change at
    // any time. The HTML form is never indexed.
    //
    // Markup is stripped before indexing. A Markdown link target is a term to
    // Postgres, so an unfiltered index answers a search for "reference" with
    // every page that happens to link to one — which is the same reason the
    // HTML form is not indexed, arriving by a different route. Both
    // replacements are IMMUTABLE, which a generated column requires.
    //
    // The bracket expressions are deliberate: a backslash escape does not
    // survive this template literal, and the regex it decays into strips every
    // word after a stray "]" rather than only a link target.
    search: tsvector("search").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', regexp_replace(regexp_replace(${linkContentTable.markdown}, '[]][(][^)]*[)]', ']', 'g'), 'https?://[^[:space:]]+', ' ', 'g'))`,
    ),
    extractedAt: timestamp("extracted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("link_content_search_idx").using("gin", table.search),
  ],
)

export const sourcesTable = pgTable(
  "sources",
  {
    id: text("id")
      .$type<SourceId>()
      .primaryKey()
      .$defaultFn(() => randomUUID() as SourceId),
    userId: text("user_id")
      .$type<UserId>()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sources_user_name_unique").on(table.userId, table.name),
  ],
)

export const foldersTable = pgTable(
  "folders",
  {
    id: text("id")
      .$type<FolderId>()
      .primaryKey()
      .$defaultFn(() => randomUUID() as FolderId),
    userId: text("user_id")
      .$type<UserId>()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji"),
    color: text("color"),
    // A Published Folder shows every Saved Item inside it on the Public
    // Profile. False by default: publishing is a deliberate act, so a Folder
    // nobody published shows nothing.
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("folders_user_name_lower_unique").on(table.userId, sql`lower(${table.name})`),
  ],
)

// One Public Profile record per Account. The Handle lives here rather than on
// the Better Auth user because it is a product identifier, not a credential.
// Handles are stored lowercase; the lower() index keeps two Accounts from
// holding Handles that differ only by case, the same way Folder names work.
export const profilesTable = pgTable(
  "profiles",
  {
    id: text("id")
      .$type<ProfileId>()
      .primaryKey()
      .$defaultFn(() => randomUUID() as ProfileId),
    userId: text("user_id")
      .$type<UserId>()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    visibility: profileVisibilityEnum("visibility")
      .$type<ProfileVisibility>()
      .notNull()
      .default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("profiles_user_id_unique").on(table.userId),
    uniqueIndex("profiles_handle_lower_unique").on(sql`lower(${table.handle})`),
  ],
)

export const savedItemsTable = pgTable(
  "saved_items",
  {
    id: text("id")
      .$type<SavedItemId>()
      .primaryKey()
      .$defaultFn(() => randomUUID() as SavedItemId),
    userId: text("user_id")
      .$type<UserId>()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    linkId: text("link_id")
      .$type<LinkId>()
      .notNull()
      .references(() => linksTable.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .$type<SourceId>()
      .references(() => sourcesTable.id, { onDelete: "set null" }),
    folderId: text("folder_id")
      .$type<FolderId>()
      .references(() => foldersTable.id, { onDelete: "set null" }),
    captureChannel: captureChannelEnum("capture_channel").$type<CaptureChannel>(),
    tags: text("tags").array().notNull().default([]),
    isRead: boolean("is_read").notNull().default(false),
    lastSavedAt: timestamp("last_saved_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("saved_items_user_link_unique").on(
      table.userId,
      table.linkId,
    ),
    index("saved_items_user_last_saved_at_idx").on(
      table.userId,
      table.lastSavedAt,
    ),
    // Reading Activity groups an Account's saves by creation day over a rolling
    // 52 weeks, and the public Saved Item list orders by creation time too. The
    // Last Saved At index above serves neither, because a Duplicate Save moves a
    // row inside it while its creation day stays put.
    index("saved_items_user_created_at_idx").on(table.userId, table.createdAt),
    index("saved_items_user_folder_id_idx").on(table.userId, table.folderId),
  ],
)

export const connectCodesTable = pgTable(
  "connect_codes",
  {
    code: text("code").primaryKey(),
    userId: text("user_id")
      .$type<UserId>()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    client: text("client").notNull(),
    scopes: text("scopes").array().notNull(),
    label: text("label").notNull(),
    deviceHint: text("device_hint"),
    codeChallenge: text("code_challenge").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => [
    index("connect_codes_expires_at_idx").on(table.expiresAt),
  ],
)

export const enrichmentJobsTable = pgTable("enrichment_jobs", {
  id: text("id")
    .$type<EnrichmentJobId>()
    .primaryKey()
    .$defaultFn(() => randomUUID() as EnrichmentJobId),
  linkId: text("link_id")
    .$type<LinkId>()
    .notNull()
    .references(() => linksTable.id, { onDelete: "cascade" }),
  attempt: integer("attempt").notNull(),
  status: enrichmentJobStatusEnum("status").$type<EnrichmentJobStatus>().notNull(),
  stagesJson: jsonb("stages_json").notNull().default([]),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
})

export const relationalSchema = {
  user,
  session,
  account,
  verification,
  apikey,
  jwks,
  oauthClient,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  links: linksTable,
  linkMetadata: linkMetadataTable,
  linkEnrichment: linkEnrichmentTable,
  linkContent: linkContentTable,
  sources: sourcesTable,
  folders: foldersTable,
  profiles: profilesTable,
  savedItems: savedItemsTable,
  enrichmentJobs: enrichmentJobsTable,
} as const

export const relations = defineRelations(relationalSchema, (r) => ({
  links: {
    metadata: r.one.linkMetadata({
      from: r.links.id,
      to: r.linkMetadata.linkId,
      optional: false,
    }),
    enrichment: r.one.linkEnrichment({
      from: r.links.id,
      to: r.linkEnrichment.linkId,
      optional: false,
    }),
    content: r.one.linkContent({
      from: r.links.id,
      to: r.linkContent.linkId,
      optional: true,
    }),
    savedItems: r.many.savedItems({
      from: r.links.id,
      to: r.savedItems.linkId,
    }),
    enrichmentJobs: r.many.enrichmentJobs({
      from: r.links.id,
      to: r.enrichmentJobs.linkId,
    }),
  },
  linkMetadata: {
    link: r.one.links({
      from: r.linkMetadata.linkId,
      to: r.links.id,
      optional: false,
    }),
  },
  linkEnrichment: {
    link: r.one.links({
      from: r.linkEnrichment.linkId,
      to: r.links.id,
      optional: false,
    }),
  },
  linkContent: {
    link: r.one.links({
      from: r.linkContent.linkId,
      to: r.links.id,
      optional: false,
    }),
  },
  sources: {
    savedItems: r.many.savedItems({
      from: r.sources.id,
      to: r.savedItems.sourceId,
    }),
  },
  folders: {
    savedItems: r.many.savedItems({
      from: r.folders.id,
      to: r.savedItems.folderId,
    }),
  },
  savedItems: {
    link: r.one.links({
      from: r.savedItems.linkId,
      to: r.links.id,
      optional: false,
    }),
    source: r.one.sources({
      from: r.savedItems.sourceId,
      to: r.sources.id,
      optional: true,
    }),
    folder: r.one.folders({
      from: r.savedItems.folderId,
      to: r.folders.id,
      optional: true,
    }),
  },
  enrichmentJobs: {
    link: r.one.links({
      from: r.enrichmentJobs.linkId,
      to: r.links.id,
      optional: false,
    }),
  },
}))

// Keys double as Better Auth model names — the drizzle adapter resolves
// tables via schema[model], so every table a Better Auth plugin touches
// must be listed here under its model name.
export const schema = {
  user,
  session,
  account,
  verification,
  apikey,
  jwks,
  oauthClient,
  oauthAccessToken,
  oauthRefreshToken,
  oauthConsent,
  linksTable,
  linkMetadataTable,
  linkEnrichmentTable,
  linkContentTable,
  sourcesTable,
  foldersTable,
  profilesTable,
  savedItemsTable,
  enrichmentJobsTable,
  connectCodesTable,
}
