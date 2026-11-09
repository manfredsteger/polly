ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "creator_language" text;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "voter_language" text;
