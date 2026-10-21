CREATE TABLE "git_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"action" text NOT NULL,
	"branch" text,
	"remote" text,
	"message" text,
	"pushes_base" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"decided_by" uuid,
	"output" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "git_operations" ADD CONSTRAINT "git_operations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_operations" ADD CONSTRAINT "git_operations_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_operations" ADD CONSTRAINT "git_operations_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_operations" ADD CONSTRAINT "git_operations_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "git_operations_group" ON "git_operations" USING btree ("group_id","created_at");