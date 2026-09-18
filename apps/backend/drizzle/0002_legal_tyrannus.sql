CREATE TABLE "summoner_resource_reads" (
	"puuid" text NOT NULL,
	"region" varchar(8) NOT NULL,
	"resource" varchar(32) NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "summoner_resource_reads_puuid_region_resource_pk" PRIMARY KEY("puuid","region","resource")
);
--> statement-breakpoint
ALTER TABLE "summoner_resource_reads" ADD CONSTRAINT "summoner_resource_reads_puuid_region_summoners_puuid_region_fk" FOREIGN KEY ("puuid","region") REFERENCES "public"."summoners"("puuid","region") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "summoner_resource_reads" ("puuid", "region", "resource", "read_at")
SELECT "puuid", "region", 'ranks', "ranks_updated_at"
FROM "summoners"
WHERE "ranks_updated_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "summoners" DROP COLUMN "ranks_updated_at";