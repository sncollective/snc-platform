ALTER TABLE "creator_profiles" DROP CONSTRAINT "creator_profiles_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "creator_profiles" DROP COLUMN "owner_id";
