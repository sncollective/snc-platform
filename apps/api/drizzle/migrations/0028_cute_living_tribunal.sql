CREATE TABLE "creator_join_configs" (
	"creator_id" text PRIMARY KEY NOT NULL,
	"incentive_text" text,
	"show_snc_explainer" boolean DEFAULT true NOT NULL,
	"show_subscribe_cta" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_join_configs" ADD CONSTRAINT "creator_join_configs_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;