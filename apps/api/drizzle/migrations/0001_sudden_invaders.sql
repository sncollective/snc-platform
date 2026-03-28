CREATE TABLE "stream_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stream_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"stream_key_id" text NOT NULL,
	"srs_client_id" text NOT NULL,
	"srs_stream_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"peak_viewers" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stream_events" ADD CONSTRAINT "stream_events_session_id_stream_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stream_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_keys" ADD CONSTRAINT "stream_keys_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_stream_key_id_stream_keys_id_fk" FOREIGN KEY ("stream_key_id") REFERENCES "public"."stream_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stream_events_session_idx" ON "stream_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "stream_events_type_idx" ON "stream_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "stream_keys_creator_idx" ON "stream_keys" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "stream_keys_hash_idx" ON "stream_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "stream_sessions_creator_idx" ON "stream_sessions" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "stream_sessions_active_idx" ON "stream_sessions" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "stream_sessions_srs_client_idx" ON "stream_sessions" USING btree ("srs_client_id");