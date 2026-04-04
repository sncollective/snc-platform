CREATE TABLE "mastodon_apps" (
	"instance_domain" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
