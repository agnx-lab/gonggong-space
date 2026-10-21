CREATE TABLE "group_plugins" (
	"group_id" uuid NOT NULL,
	"plugin_id" uuid NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_plugins_group_id_plugin_id_pk" PRIMARY KEY("group_id","plugin_id")
);
--> statement-breakpoint
CREATE TABLE "plugin_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"files" jsonb NOT NULL,
	"manifest" jsonb NOT NULL,
	"digest" text NOT NULL,
	"size" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_versions_plugin_id_revision_unique" UNIQUE("plugin_id","revision")
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"team_id" uuid,
	"group_id" uuid,
	"name" text NOT NULL,
	"version_id" uuid,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugins_scope_team_id_group_id_name_unique" UNIQUE NULLS NOT DISTINCT("scope","team_id","group_id","name")
);
--> statement-breakpoint
CREATE TABLE "question_leanings" (
	"question_set_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"choice" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_leanings_question_set_id_question_id_choice_user_id_pk" PRIMARY KEY("question_set_id","question_id","choice","user_id")
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "plugins" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "group_plugins" ADD CONSTRAINT "group_plugins_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_plugins" ADD CONSTRAINT "group_plugins_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_plugins" ADD CONSTRAINT "group_plugins_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_leanings" ADD CONSTRAINT "question_leanings_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."question_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_leanings" ADD CONSTRAINT "question_leanings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;