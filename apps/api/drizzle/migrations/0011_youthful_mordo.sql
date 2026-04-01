ALTER TABLE "channel_content" ALTER COLUMN "playout_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_content" ADD COLUMN "content_id" text;--> statement-breakpoint
ALTER TABLE "channel_content" ADD CONSTRAINT "channel_content_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_content_channel_content_idx" ON "channel_content" USING btree ("channel_id","content_id");