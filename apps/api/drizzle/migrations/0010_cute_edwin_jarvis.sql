CREATE TABLE "channel_content" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"playout_item_id" text NOT NULL,
	"last_played_at" timestamp with time zone,
	"play_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playout_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"playout_item_id" text NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"pushed_to_liquidsoap" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_content" ADD CONSTRAINT "channel_content_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_content" ADD CONSTRAINT "channel_content_playout_item_id_playout_items_id_fk" FOREIGN KEY ("playout_item_id") REFERENCES "public"."playout_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_queue" ADD CONSTRAINT "playout_queue_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_queue" ADD CONSTRAINT "playout_queue_playout_item_id_playout_items_id_fk" FOREIGN KEY ("playout_item_id") REFERENCES "public"."playout_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_content_channel_item_idx" ON "channel_content" USING btree ("channel_id","playout_item_id");--> statement-breakpoint
CREATE INDEX "channel_content_channel_idx" ON "channel_content" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "channel_content_last_played_idx" ON "channel_content" USING btree ("channel_id","last_played_at");--> statement-breakpoint
CREATE INDEX "playout_queue_channel_position_idx" ON "playout_queue" USING btree ("channel_id","position");--> statement-breakpoint
CREATE INDEX "playout_queue_channel_status_idx" ON "playout_queue" USING btree ("channel_id","status");