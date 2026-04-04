CREATE TABLE "chat_moderation_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"target_user_name" text NOT NULL,
	"moderator_user_id" text NOT NULL,
	"moderator_user_name" text NOT NULL,
	"action" text NOT NULL,
	"duration_seconds" integer,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_word_filters" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"pattern" text NOT NULL,
	"is_regex" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD COLUMN "slow_mode_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_moderation_actions" ADD CONSTRAINT "chat_moderation_actions_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_moderation_actions" ADD CONSTRAINT "chat_moderation_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_moderation_actions" ADD CONSTRAINT "chat_moderation_actions_moderator_user_id_users_id_fk" FOREIGN KEY ("moderator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_word_filters" ADD CONSTRAINT "chat_word_filters_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_mod_actions_room_created_idx" ON "chat_moderation_actions" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_mod_actions_target_idx" ON "chat_moderation_actions" USING btree ("target_user_id","room_id");--> statement-breakpoint
CREATE INDEX "chat_word_filters_room_idx" ON "chat_word_filters" USING btree ("room_id");