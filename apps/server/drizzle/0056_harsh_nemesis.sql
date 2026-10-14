ALTER TABLE "group_members" ADD COLUMN "done_seq" bigint;--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;