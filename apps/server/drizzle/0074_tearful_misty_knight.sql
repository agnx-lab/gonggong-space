CREATE TABLE "group_pinned_messages" (
	"group_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"pinned_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_pinned_messages_group_id_message_id_pk" PRIMARY KEY("group_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "group_pinned_messages" ADD CONSTRAINT "group_pinned_messages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_pinned_messages" ADD CONSTRAINT "group_pinned_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_pinned_messages" ADD CONSTRAINT "group_pinned_messages_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;