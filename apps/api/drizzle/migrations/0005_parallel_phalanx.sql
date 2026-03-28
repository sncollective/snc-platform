CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"thumbnail_url" text,
	"srs_stream_name" text NOT NULL,
	"creator_id" text,
	"stream_session_id" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_stream_session_id_stream_sessions_id_fk";
--> statement-breakpoint
DROP INDEX "chat_rooms_session_idx";--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD COLUMN "channel_id" text;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_stream_session_id_stream_sessions_id_fk" FOREIGN KEY ("stream_session_id") REFERENCES "public"."stream_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_srs_stream_name_idx" ON "channels" USING btree ("srs_stream_name");--> statement-breakpoint
CREATE INDEX "channels_type_active_idx" ON "channels" USING btree ("type","is_active");--> statement-breakpoint
CREATE INDEX "channels_creator_idx" ON "channels" USING btree ("creator_id");--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_rooms_channel_idx" ON "chat_rooms" USING btree ("channel_id");--> statement-breakpoint
ALTER TABLE "chat_rooms" DROP COLUMN "stream_session_id";