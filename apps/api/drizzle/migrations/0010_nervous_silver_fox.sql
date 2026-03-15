ALTER TABLE "creator_profiles" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_handle_unique" UNIQUE("handle");