CREATE TABLE "channel_connection_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_connection_id" uuid NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"encryption_key_version" integer DEFAULT 1 NOT NULL,
	"webhook_secret_hash" char(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_connections" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_connection_secrets" ADD CONSTRAINT "channel_connection_secrets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_connection_secrets" ADD CONSTRAINT "channel_connection_secrets_channel_connection_id_channel_connections_id_fk" FOREIGN KEY ("channel_connection_id") REFERENCES "public"."channel_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connection_secrets_connection_unique" ON "channel_connection_secrets" USING btree ("channel_connection_id");--> statement-breakpoint
CREATE INDEX "channel_connection_secrets_workspace_idx" ON "channel_connection_secrets" USING btree ("workspace_id");
