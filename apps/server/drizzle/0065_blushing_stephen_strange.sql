CREATE INDEX "group_bots_bot" ON "group_bots" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "messages_append_to" ON "messages" USING btree (("meta"->>'appendTo')) WHERE ("messages"."meta"->>'appendTo') is not null;--> statement-breakpoint
CREATE INDEX "messages_schedule_of" ON "messages" USING btree (("meta"->>'scheduleOf'),"seq") WHERE ("messages"."meta"->>'scheduleOf') is not null;--> statement-breakpoint
CREATE INDEX "runs_group_bot_started" ON "runs" USING btree ("group_id","bot_id","started_at");--> statement-breakpoint
CREATE INDEX "runs_parent" ON "runs" USING btree ("parent_run_id");--> statement-breakpoint
CREATE INDEX "sync_replicas_bot" ON "sync_replicas" USING btree ("bot_id");