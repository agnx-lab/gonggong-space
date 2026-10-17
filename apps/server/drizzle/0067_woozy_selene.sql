-- pg_trgm is trusted (PG13+): the database owner can create it without superuser.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "search_text" text;--> statement-breakpoint
-- IF NOT EXISTS: on a large database it may be built beforehand with CREATE INDEX CONCURRENTLY (migrations run in a transaction).
CREATE INDEX IF NOT EXISTS "messages_body_trgm" ON "messages" USING gin ("body" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "runs_search_text" ON "runs" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "runs_search_pending" ON "runs" USING btree ("created_at") WHERE "runs"."search_text" is null;
