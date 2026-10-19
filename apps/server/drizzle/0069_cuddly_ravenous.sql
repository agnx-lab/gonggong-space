CREATE TABLE "group_knowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid,
	"updated_by_bot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "group_knowledge_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tags" jsonb NOT NULL,
	"action" text NOT NULL,
	"by_user_id" uuid,
	"by_bot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_knowledge_versions_entry_id_version_unique" UNIQUE("entry_id","version")
);
--> statement-breakpoint
ALTER TABLE "group_bots" ADD COLUMN "knowledge_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "group_knowledge" ADD CONSTRAINT "group_knowledge_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_knowledge" ADD CONSTRAINT "group_knowledge_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_knowledge" ADD CONSTRAINT "group_knowledge_updated_by_bot_id_bots_id_fk" FOREIGN KEY ("updated_by_bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_knowledge_versions" ADD CONSTRAINT "group_knowledge_versions_entry_id_group_knowledge_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."group_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_knowledge_versions" ADD CONSTRAINT "group_knowledge_versions_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_knowledge_versions" ADD CONSTRAINT "group_knowledge_versions_by_bot_id_bots_id_fk" FOREIGN KEY ("by_bot_id") REFERENCES "public"."bots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_knowledge_group" ON "group_knowledge" USING btree ("group_id","updated_at");