ALTER TABLE "calendar_events" ADD COLUMN "creator_id" text;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_creator_id_creator_profiles_id_fk"
  FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX "calendar_events_creator_deleted_idx"
  ON "calendar_events" ("creator_id", "deleted_at") WHERE "creator_id" IS NOT NULL;
