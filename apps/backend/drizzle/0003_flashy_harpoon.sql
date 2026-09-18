CREATE TABLE "summoner_masteries" (
	"puuid" text NOT NULL,
	"region" varchar(8) NOT NULL,
	"champion_id" integer NOT NULL,
	"champion_level" integer NOT NULL,
	"champion_points" integer NOT NULL,
	"last_play_time" timestamp with time zone NOT NULL,
	CONSTRAINT "summoner_masteries_puuid_region_champion_id_pk" PRIMARY KEY("puuid","region","champion_id")
);
--> statement-breakpoint
ALTER TABLE "summoner_masteries" ADD CONSTRAINT "summoner_masteries_puuid_region_summoners_puuid_region_fk" FOREIGN KEY ("puuid","region") REFERENCES "public"."summoners"("puuid","region") ON DELETE cascade ON UPDATE no action;