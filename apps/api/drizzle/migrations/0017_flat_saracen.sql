CREATE TABLE "inbox_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_url" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbox_notifications_user_read_created_idx" ON "inbox_notifications" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE INDEX "inbox_notifications_user_created_idx" ON "inbox_notifications" USING btree ("user_id","created_at");