CREATE TABLE "processing_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"content_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "video_codec" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "audio_codec" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "duration" real;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "bitrate" integer;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "processing_status" text;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "transcoded_media_key" text;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "processing_jobs_content_idx" ON "processing_jobs" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "processing_jobs_type_status_idx" ON "processing_jobs" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "content_processing_status_idx" ON "content" USING btree ("processing_status");