CREATE TABLE "summoner_ranks" (
	"puuid" text NOT NULL,
	"region" varchar(8) NOT NULL,
	"queue" varchar(32) NOT NULL,
	"tier" varchar(16) NOT NULL,
	"division" varchar(4) NOT NULL,
	"league_points" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	CONSTRAINT "summoner_ranks_puuid_region_queue_pk" PRIMARY KEY("puuid","region","queue")
);
--> statement-breakpoint
ALTER TABLE "summoners" ADD COLUMN "ranks_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "summoner_ranks" ADD CONSTRAINT "summoner_ranks_puuid_region_summoners_puuid_region_fk" FOREIGN KEY ("puuid","region") REFERENCES "public"."summoners"("puuid","region") ON DELETE cascade ON UPDATE no action;