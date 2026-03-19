ALTER TABLE "projects" ADD COLUMN "slug" text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");
