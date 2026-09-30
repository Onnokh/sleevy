CREATE TABLE "account_settings" (
	"user_id" text PRIMARY KEY,
	"auto_filing" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Auto-Filing is on for new Accounts only. Every Account that exists before it
-- ships gets it off, so no Library starts filing itself without being asked.
INSERT INTO "account_settings" ("user_id", "auto_filing") SELECT "id", false FROM "user";
