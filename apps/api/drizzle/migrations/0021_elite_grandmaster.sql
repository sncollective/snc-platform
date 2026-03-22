ALTER TABLE "content" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "content_creator_slug_idx" ON "content" USING btree ("creator_id","slug");