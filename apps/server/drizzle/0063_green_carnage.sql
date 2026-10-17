ALTER TABLE "bots" ADD COLUMN "agent_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "settings" jsonb;