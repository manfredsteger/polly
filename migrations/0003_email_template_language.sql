ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" DROP CONSTRAINT IF EXISTS "email_templates_type_unique";--> statement-breakpoint
ALTER TABLE "email_templates" DROP CONSTRAINT IF EXISTS "email_templates_type_key";--> statement-breakpoint
DROP INDEX IF EXISTS "email_templates_type_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "email_templates_type_key";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_type_language_unique" ON "email_templates" USING btree ("type","language");
