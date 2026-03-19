-- Create projects table
CREATE TABLE "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "creator_id" text REFERENCES "creator_profiles"("id") ON DELETE CASCADE,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "completed" boolean DEFAULT false NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "projects_creator_idx" ON "projects" ("creator_id");
--> statement-breakpoint
CREATE INDEX "projects_completed_idx" ON "projects" ("completed");
--> statement-breakpoint

-- Rename category to event_type on calendar_events
ALTER TABLE "calendar_events" RENAME COLUMN "category" TO "event_type";
--> statement-breakpoint

-- Drop old category index and create new event_type index
DROP INDEX IF EXISTS "calendar_events_category_deleted_idx";
--> statement-breakpoint
CREATE INDEX "calendar_events_event_type_deleted_idx" ON "calendar_events" ("event_type", "deleted_at");
--> statement-breakpoint

-- Add project_id FK to calendar_events
ALTER TABLE "calendar_events" ADD COLUMN "project_id" text REFERENCES "projects"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "calendar_events_project_deleted_idx" ON "calendar_events" ("project_id", "deleted_at");
--> statement-breakpoint

-- Create custom_event_types table
CREATE TABLE "custom_event_types" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "slug" text NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "custom_event_types_slug_idx" ON "custom_event_types" ("slug");