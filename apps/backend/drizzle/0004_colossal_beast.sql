CREATE TABLE "matches" (
	"match_id" text PRIMARY KEY NOT NULL,
	"platform_id" varchar(8) NOT NULL,
	"queue_id" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"game_version" varchar(32) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_participants" (
	"match_id" text NOT NULL,
	"puuid" text NOT NULL,
	"team_id" integer NOT NULL,
	"champion_id" integer NOT NULL,
	"team_position" varchar(16) NOT NULL,
	"win" boolean NOT NULL,
	"kills" integer NOT NULL,
	"deaths" integer NOT NULL,
	"assists" integer NOT NULL,
	"creep_score" integer NOT NULL,
	"gold_earned" integer NOT NULL,
	"total_damage_dealt_to_champions" integer NOT NULL,
	"items" integer[] NOT NULL,
	"riot_id_game_name" text NOT NULL,
	"riot_id_tagline" text NOT NULL,
	CONSTRAINT "match_participants_match_id_puuid_pk" PRIMARY KEY("match_id","puuid")
);
--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("match_id") ON DELETE cascade ON UPDATE no action;