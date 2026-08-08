CREATE TABLE "content_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_creator_id" text NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"original_filename" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_owner_creator_id_creator_profiles_id_fk" FOREIGN KEY ("owner_creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_assets_owner_sha256_idx" ON "content_assets" USING btree ("owner_creator_id","sha256");--> statement-breakpoint
CREATE INDEX "content_assets_owner_idx" ON "content_assets" USING btree ("owner_creator_id");