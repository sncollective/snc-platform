ALTER TABLE "playout_queue" ALTER COLUMN "playout_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "playout_queue" ADD COLUMN "content_id" text;--> statement-breakpoint
ALTER TABLE "playout_queue" ADD CONSTRAINT "playout_queue_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playout_queue" ADD CONSTRAINT "playout_queue_one_source" CHECK (num_nonnulls(playout_item_id, content_id) = 1);