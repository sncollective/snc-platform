CREATE TABLE "playout_items" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"director" text,
	"s3_key_prefix" text NOT NULL,
	"source_key" text,
	"source_width" integer,
	"source_height" integer,
	"duration" real,
	"rendition_1080p_key" text,
	"rendition_720p_key" text,
	"rendition_480p_key" text,
	"rendition_audio_key" text,
	"subtitle_key" text,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"position" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "playout_items_position_idx" ON "playout_items" USING btree ("position");--> statement-breakpoint
CREATE INDEX "playout_items_status_idx" ON "playout_items" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "playout_items_enabled_idx" ON "playout_items" USING btree ("enabled","position");