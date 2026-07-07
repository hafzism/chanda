CREATE TABLE "oauth_connection_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" char(64) NOT NULL,
	"provider" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_connection_secrets" ALTER COLUMN "webhook_secret_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_connection_states" ADD CONSTRAINT "oauth_connection_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_connection_states" ADD CONSTRAINT "oauth_connection_states_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_connection_states_hash_unique" ON "oauth_connection_states" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "oauth_connection_states_expiry_idx" ON "oauth_connection_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_connection_states_workspace_idx" ON "oauth_connection_states" USING btree ("workspace_id");
