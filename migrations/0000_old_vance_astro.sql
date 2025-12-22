CREATE TABLE "email_change_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"new_email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_change_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" uuid NOT NULL,
	"type" text NOT NULL,
	"recipient_email" text NOT NULL,
	"sent_by" text,
	"sent_by_guest" boolean DEFAULT false NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" uuid NOT NULL,
	"text" text NOT NULL,
	"image_url" text,
	"alt_text" text,
	"start_time" timestamp,
	"end_time" timestamp,
	"max_capacity" integer,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"user_id" integer,
	"creator_email" text,
	"admin_token" text NOT NULL,
	"public_token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"allow_anonymous_voting" boolean DEFAULT true NOT NULL,
	"allow_multiple_slots" boolean DEFAULT true NOT NULL,
	"max_slots_per_user" integer,
	"allow_vote_edit" boolean DEFAULT false NOT NULL,
	"allow_vote_withdrawal" boolean DEFAULT false NOT NULL,
	"results_public" boolean DEFAULT true NOT NULL,
	"allow_maybe" boolean DEFAULT true NOT NULL,
	"is_test_data" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"enable_expiry_reminder" boolean DEFAULT false NOT NULL,
	"expiry_reminder_hours" integer DEFAULT 24,
	"expiry_reminder_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "polls_admin_token_unique" UNIQUE("admin_token"),
	CONSTRAINT "polls_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "test_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"test_file" text NOT NULL,
	"test_name" text NOT NULL,
	"test_type" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_status" text,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "test_configurations_test_id_unique" UNIQUE("test_id")
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"test_file" text NOT NULL,
	"test_name" text NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"duration" integer,
	"error" text,
	"error_stack" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"triggered_by" text DEFAULT 'manual' NOT NULL,
	"total_tests" integer DEFAULT 0,
	"passed" integer DEFAULT 0,
	"failed" integer DEFAULT 0,
	"skipped" integer DEFAULT 0,
	"duration" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"organization" text,
	"password_hash" text,
	"keycloak_id" text,
	"provider" text DEFAULT 'local',
	"theme_preference" text DEFAULT 'system',
	"calendar_token" text,
	"is_test_data" boolean DEFAULT false NOT NULL,
	"is_initial_admin" boolean DEFAULT false NOT NULL,
	"deletion_requested_at" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_keycloak_id_unique" UNIQUE("keycloak_id"),
	CONSTRAINT "users_calendar_token_unique" UNIQUE("calendar_token")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" integer NOT NULL,
	"voter_name" text NOT NULL,
	"voter_email" text NOT NULL,
	"user_id" integer,
	"voter_key" text,
	"voter_source" text,
	"response" text NOT NULL,
	"comment" text,
	"voter_edit_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
