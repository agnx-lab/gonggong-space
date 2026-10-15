CREATE TABLE "group_skill_overrides" (
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_skill_overrides_group_id_name_pk" PRIMARY KEY("group_id","name")
);
--> statement-breakpoint
ALTER TABLE "group_skill_overrides" ADD CONSTRAINT "group_skill_overrides_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_skill_overrides" ADD CONSTRAINT "group_skill_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;