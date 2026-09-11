CREATE TABLE "summoners" (
	"puuid" text NOT NULL,
	"region" varchar(8) NOT NULL,
	"game_name" text NOT NULL,
	"tag_line" text NOT NULL,
	"profile_icon_id" integer NOT NULL,
	"summoner_level" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "summoners_puuid_region_pk" PRIMARY KEY("puuid","region")
);
--> statement-breakpoint
CREATE TABLE "summoner_riot_ids" (
	"region" varchar(8) NOT NULL,
	"game_name" text NOT NULL,
	"tag_line" text NOT NULL,
	"puuid" text NOT NULL,
	CONSTRAINT "summoner_riot_ids_region_game_name_tag_line_pk" PRIMARY KEY("region","game_name","tag_line")
);
--> statement-breakpoint
ALTER TABLE "summoner_riot_ids" ADD CONSTRAINT "summoner_riot_ids_puuid_region_summoners_puuid_region_fk" FOREIGN KEY ("puuid","region") REFERENCES "public"."summoners"("puuid","region") ON DELETE cascade ON UPDATE no action;