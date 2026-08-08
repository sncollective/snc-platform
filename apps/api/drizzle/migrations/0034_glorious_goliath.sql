CREATE TYPE "public"."content_asset_sharing" AS ENUM('private', 'requestable', 'open');--> statement-breakpoint
CREATE TABLE "content_asset_grants" (
	"asset_id" text NOT NULL,
	"grantee_creator_id" text NOT NULL,
	"granted_by_user_id" text NOT NULL,
	"granted_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"blob_sha256" text NOT NULL,
	"creator_id" text,
	"sharing" "content_asset_sharing" DEFAULT 'private' NOT NULL,
	"original_filename" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "content_blobs" (
	"sha256" text PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_blobs_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "content_asset_grants" ADD CONSTRAINT "content_asset_grants_asset_id_content_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."content_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_asset_grants" ADD CONSTRAINT "content_asset_grants_grantee_creator_id_creator_profiles_id_fk" FOREIGN KEY ("grantee_creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_asset_grants" ADD CONSTRAINT "content_asset_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_blob_sha256_content_blobs_sha256_fk" FOREIGN KEY ("blob_sha256") REFERENCES "public"."content_blobs"("sha256") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_asset_grants_asset_grantee_idx" ON "content_asset_grants" USING btree ("asset_id","grantee_creator_id");--> statement-breakpoint
CREATE INDEX "content_asset_grants_grantee_idx" ON "content_asset_grants" USING btree ("grantee_creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_assets_creator_blob_idx" ON "content_assets" USING btree ("creator_id","blob_sha256") WHERE "content_assets"."creator_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "content_assets_admin_blob_idx" ON "content_assets" USING btree ("blob_sha256") WHERE "content_assets"."creator_id" is null;--> statement-breakpoint
CREATE INDEX "content_assets_creator_idx" ON "content_assets" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "content_assets_blob_idx" ON "content_assets" USING btree ("blob_sha256");--> statement-breakpoint
CREATE INDEX "content_assets_browse_idx" ON "content_assets" USING btree ("deleted_at","sharing","created_at");--> statement-breakpoint
CREATE INDEX "content_blobs_created_at_idx" ON "content_blobs" USING btree ("created_at");