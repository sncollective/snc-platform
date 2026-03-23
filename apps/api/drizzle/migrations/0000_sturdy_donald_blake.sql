CREATE TABLE "booking_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"service_id" text NOT NULL,
	"preferred_dates" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"pricing_info" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"event_type" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"creator_id" text,
	"project_id" text,
	"deleted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_feed_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_event_types" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"body" text,
	"description" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"source_type" text DEFAULT 'upload' NOT NULL,
	"thumbnail_key" text,
	"media_key" text,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_members" (
	"creator_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_members_creator_id_user_id_pk" PRIMARY KEY("creator_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar_key" text,
	"banner_key" text,
	"social_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"handle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "emissions" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"scope" integer NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"source" text NOT NULL,
	"description" text NOT NULL,
	"amount" real NOT NULL,
	"unit" text NOT NULL,
	"co2_kg" real NOT NULL,
	"method" text NOT NULL,
	"projected" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text,
	"scopes" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "oauth_access_tokens_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "oauth_access_tokens_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "oauth_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"metadata" text,
	"disabled" boolean DEFAULT false NOT NULL,
	"redirect_urls" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "oauth_applications_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scopes" text NOT NULL,
	"consent_given" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"creator_id" text,
	"created_by" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"creator_id" text,
	"stripe_price_id" text NOT NULL,
	"price" integer NOT NULL,
	"interval" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_stripe_price_id_unique" UNIQUE("stripe_price_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_feed_tokens" ADD CONSTRAINT "calendar_feed_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_event_types" ADD CONSTRAINT "custom_event_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_members" ADD CONSTRAINT "creator_members_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_members" ADD CONSTRAINT "creator_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_oauth_applications_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_applications" ADD CONSTRAINT "oauth_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_client_id_oauth_applications_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_requests_user_status_idx" ON "booking_requests" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "booking_requests_status_created_idx" ON "booking_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "services_active_sort_idx" ON "services" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "calendar_events_start_deleted_idx" ON "calendar_events" USING btree ("start_at","deleted_at");--> statement-breakpoint
CREATE INDEX "calendar_events_event_type_deleted_idx" ON "calendar_events" USING btree ("event_type","deleted_at");--> statement-breakpoint
CREATE INDEX "calendar_events_created_by_idx" ON "calendar_events" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "calendar_events_creator_deleted_idx" ON "calendar_events" USING btree ("creator_id","deleted_at");--> statement-breakpoint
CREATE INDEX "calendar_events_project_deleted_idx" ON "calendar_events" USING btree ("project_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feed_tokens_token_idx" ON "calendar_feed_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "calendar_feed_tokens_user_idx" ON "calendar_feed_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_event_types_slug_idx" ON "custom_event_types" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "content_creator_active_idx" ON "content" USING btree ("creator_id","deleted_at");--> statement-breakpoint
CREATE INDEX "content_type_active_idx" ON "content" USING btree ("type","deleted_at");--> statement-breakpoint
CREATE INDEX "content_feed_idx" ON "content" USING btree ("visibility","deleted_at","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "content_creator_slug_idx" ON "content" USING btree ("creator_id","slug");--> statement-breakpoint
CREATE INDEX "creator_members_user_role_idx" ON "creator_members" USING btree ("user_id","role");--> statement-breakpoint
CREATE INDEX "creator_members_creator_role_idx" ON "creator_members" USING btree ("creator_id","role");--> statement-breakpoint
CREATE INDEX "emissions_date_idx" ON "emissions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "emissions_scope_category_idx" ON "emissions" USING btree ("scope","category");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_creator_idx" ON "projects" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "projects_completed_idx" ON "projects" USING btree ("completed");--> statement-breakpoint
CREATE INDEX "subscription_plans_type_active_idx" ON "subscription_plans" USING btree ("type","active");--> statement-breakpoint
CREATE INDEX "subscription_plans_creator_active_idx" ON "subscription_plans" USING btree ("creator_id","active");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_status_idx" ON "user_subscriptions" USING btree ("user_id","status");