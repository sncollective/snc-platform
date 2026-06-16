CREATE TABLE "channel_editorial_config" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'auto' NOT NULL,
	"manual_tier_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_editorial_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"tier_type" text NOT NULL,
	"priority" integer NOT NULL,
	"source_channel_id" text
);
--> statement-breakpoint
ALTER TABLE "channel_editorial_config" ADD CONSTRAINT "channel_editorial_config_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_editorial_tiers" ADD CONSTRAINT "channel_editorial_tiers_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_editorial_tiers" ADD CONSTRAINT "channel_editorial_tiers_source_channel_id_channels_id_fk" FOREIGN KEY ("source_channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_editorial_tiers_channel_priority_idx" ON "channel_editorial_tiers" USING btree ("channel_id","priority");--> statement-breakpoint
CREATE INDEX "channel_editorial_tiers_source_idx" ON "channel_editorial_tiers" USING btree ("source_channel_id");