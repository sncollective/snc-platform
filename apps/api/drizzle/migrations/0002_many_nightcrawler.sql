CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"avatar_url" text,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"stream_session_id" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_stream_session_id_stream_sessions_id_fk" FOREIGN KEY ("stream_session_id") REFERENCES "public"."stream_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_room_created_idx" ON "chat_messages" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_rooms_type_idx" ON "chat_rooms" USING btree ("type");--> statement-breakpoint
CREATE INDEX "chat_rooms_session_idx" ON "chat_rooms" USING btree ("stream_session_id");