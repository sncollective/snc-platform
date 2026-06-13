ALTER TABLE "channels" ADD COLUMN "ownership" text DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "role" text DEFAULT 'playout' NOT NULL;--> statement-breakpoint
CREATE INDEX "channels_role_active_idx" ON "channels" USING btree ("role","is_active");