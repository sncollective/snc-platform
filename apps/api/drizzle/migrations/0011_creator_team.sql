-- 1. Add id column (nullable first), populate from user_id, make PK
ALTER TABLE "creator_profiles" ADD COLUMN "id" text;
UPDATE "creator_profiles" SET "id" = "user_id";

-- 2. Add owner_id nullable (no FK yet), populate, then add NOT NULL + FK
ALTER TABLE "creator_profiles" ADD COLUMN "owner_id" text;
UPDATE "creator_profiles" SET "owner_id" = "user_id";
ALTER TABLE "creator_profiles" ALTER COLUMN "owner_id" SET NOT NULL;
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- 3. Swap PK from user_id to id
ALTER TABLE "creator_profiles" DROP CONSTRAINT "creator_profiles_pkey";
ALTER TABLE "creator_profiles" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "creator_profiles" ADD PRIMARY KEY ("id");
ALTER TABLE "creator_profiles" DROP COLUMN "user_id";

-- 4. creator_members table + seed existing owners
CREATE TABLE "creator_members" (
  "creator_id" text NOT NULL REFERENCES "creator_profiles"("id") ON DELETE CASCADE,
  "user_id"    text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"       text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "creator_members_pk" PRIMARY KEY ("creator_id", "user_id")
);
CREATE INDEX "creator_members_user_role_idx" ON "creator_members"("user_id", "role");
CREATE INDEX "creator_members_creator_role_idx" ON "creator_members"("creator_id", "role");

INSERT INTO "creator_members"("creator_id","user_id","role","created_at")
SELECT "id", "owner_id", 'owner', now() FROM "creator_profiles";

-- 5. Repoint content FK
ALTER TABLE "content" DROP CONSTRAINT IF EXISTS "content_creator_id_users_id_fk";
ALTER TABLE "content" ADD CONSTRAINT "content_creator_id_creator_profiles_id_fk"
  FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE;

-- 6. Repoint subscription_plans FK
ALTER TABLE "subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_creator_id_users_id_fk";
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_creator_id_creator_profiles_id_fk"
  FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("id") ON DELETE SET NULL;
