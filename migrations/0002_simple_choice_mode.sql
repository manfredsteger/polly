ALTER TABLE "polls" ADD COLUMN "response_mode" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "max_selections" integer;
