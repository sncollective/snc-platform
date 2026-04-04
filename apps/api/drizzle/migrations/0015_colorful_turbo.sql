CREATE TABLE "invite_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"email" text NOT NULL,
	"payload" jsonb NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_tokens_email_idx" ON "invite_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invite_tokens_hash_idx" ON "invite_tokens" USING btree ("token_hash");