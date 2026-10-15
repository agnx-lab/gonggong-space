CREATE TABLE "group_mcp_overrides" (
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_mcp_overrides_group_id_name_pk" PRIMARY KEY("group_id","name")
);
--> statement-breakpoint
CREATE TABLE "mcp_secret_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcp_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"run_id" uuid,
	"user_id" uuid NOT NULL,
	"keys" jsonb NOT NULL,
	"force_new_session" boolean DEFAULT false NOT NULL,
	"message_id" uuid,
	"filled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_mcp_overrides" ADD CONSTRAINT "group_mcp_overrides_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_mcp_overrides" ADD CONSTRAINT "group_mcp_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_secret_requests" ADD CONSTRAINT "mcp_secret_requests_mcp_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_secret_requests" ADD CONSTRAINT "mcp_secret_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_secret_requests" ADD CONSTRAINT "mcp_secret_requests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_secret_requests" ADD CONSTRAINT "mcp_secret_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;