CREATE TABLE "creator_press_configs" (
	"creator_id" text PRIMARY KEY NOT NULL,
	"content" jsonb DEFAULT '{"enabled":false,"shortBio":null,"longBio":null,"forFansOf":[],"streamingLinks":[],"liveDatesUrl":null,"standoutTrack":null,"pressContactEmail":null,"location":null,"photos":[],"releases":[]}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_press_configs" ADD CONSTRAINT "creator_press_configs_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;