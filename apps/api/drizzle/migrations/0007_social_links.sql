-- Replace bandcamp_url + bandcamp_embeds with social_links JSONB array

-- Step 1: Add new column
ALTER TABLE "creator_profiles" ADD COLUMN "social_links" jsonb DEFAULT '[]' NOT NULL;

-- Step 2: Migrate existing bandcamp_url data into social_links
UPDATE "creator_profiles"
SET "social_links" = jsonb_build_array(jsonb_build_object('platform', 'bandcamp', 'url', "bandcamp_url"))
WHERE "bandcamp_url" IS NOT NULL;

-- Step 3: Drop old columns
ALTER TABLE "creator_profiles" DROP COLUMN IF EXISTS "bandcamp_url";
ALTER TABLE "creator_profiles" DROP COLUMN IF EXISTS "bandcamp_embeds";
