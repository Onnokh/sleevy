CREATE TABLE "link_content" (
	"link_id" text PRIMARY KEY,
	"html" text NOT NULL,
	"markdown" text NOT NULL,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('english', regexp_replace(regexp_replace("link_content"."markdown", '[]][(][^)]*[)]', ']', 'g'), 'https?://[^[:space:]]+', ' ', 'g'))) STORED,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "link_enrichment" ADD COLUMN "has_readable_content" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "link_content_search_idx" ON "link_content" USING gin ("search");--> statement-breakpoint
ALTER TABLE "link_content" ADD CONSTRAINT "link_content_link_id_links_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE;