-- Add completed_at column to calendar_events for task completion tracking
ALTER TABLE "calendar_events" ADD COLUMN "completed_at" timestamp with time zone;
