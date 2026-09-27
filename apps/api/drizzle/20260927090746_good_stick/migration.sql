CREATE TABLE "onboarding" (
	"user_id" text PRIMARY KEY,
	"getting_started_dismissed_at" timestamp with time zone,
	"command_palette_opened_at" timestamp with time zone,
	"iphone_hand_off_seen_at" timestamp with time zone,
	"iphone_card_dismissed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;