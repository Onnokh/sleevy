CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "link_content_passages" (
	"link_id" text,
	"ordinal" integer,
	"heading_path" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('english', "link_content_passages"."heading_path" || ' ' || regexp_replace(regexp_replace("link_content_passages"."content", '[]][(][^)]*[)]', ']', 'g'), 'https?://[^[:space:]]+', ' ', 'g'))) STORED,
	"embedding" vector(1024) NOT NULL,
	"embedding_model" text NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_content_passages_pkey" PRIMARY KEY("link_id","ordinal")
);
--> statement-breakpoint
ALTER TABLE "link_content" ADD COLUMN "passage_indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "link_content" ADD COLUMN "passage_index_error" text;--> statement-breakpoint
CREATE INDEX "link_content_passages_search_idx" ON "link_content_passages" USING gin ("search");--> statement-breakpoint
ALTER TABLE "link_content_passages" ADD CONSTRAINT "link_content_passages_link_id_link_content_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "link_content"("link_id") ON DELETE CASCADE;
