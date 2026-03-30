CREATE TABLE "simulcast_destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"label" text NOT NULL,
	"rtmp_url" text NOT NULL,
	"stream_key" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "simulcast_destinations_active_idx" ON "simulcast_destinations" USING btree ("is_active");