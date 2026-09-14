CREATE TYPE "readable_content_source" AS ENUM('readability', 'cloudflare-markdown');--> statement-breakpoint
CREATE TABLE "link_content" (
	"link_id" text PRIMARY KEY,
	"html" text,
	"markdown" text NOT NULL,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('english', "link_content"."markdown")) STORED,
	"source" "readable_content_source" NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "link_enrichment" ADD COLUMN "has_readable_content" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "link_content_search_idx" ON "link_content" USING gin ("search");--> statement-breakpoint
ALTER TABLE "link_content" ADD CONSTRAINT "link_content_link_id_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE;