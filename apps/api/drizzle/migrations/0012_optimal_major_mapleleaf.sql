ALTER TABLE "creator_profiles" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "creator_profiles_status_idx" ON "creator_profiles" USING btree ("status");