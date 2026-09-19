CREATE TABLE "match_timelines" (
	"match_id" text PRIMARY KEY NOT NULL,
	"frames" jsonb NOT NULL,
	"skill_level_ups" jsonb NOT NULL,
	"item_events" jsonb NOT NULL,
	"kills" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "runes" jsonb;--> statement-breakpoint
ALTER TABLE "match_timelines" ADD CONSTRAINT "match_timelines_match_id_matches_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("match_id") ON DELETE cascade ON UPDATE no action;