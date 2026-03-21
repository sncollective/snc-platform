ALTER TABLE "creator_profiles" DROP CONSTRAINT IF EXISTS "creator_profiles_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "creator_profiles" DROP CONSTRAINT IF EXISTS "creator_profiles_owner_id_fkey";
--> statement-breakpoint
ALTER TABLE "creator_profiles" DROP COLUMN IF EXISTS "owner_id";
