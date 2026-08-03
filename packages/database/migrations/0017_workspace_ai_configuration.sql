CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'google-gemini');--> statement-breakpoint
CREATE TABLE "workspace_ai_configurations" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"api_key_fingerprint" char(64) NOT NULL,
	"encryption_key_version" integer DEFAULT 1 NOT NULL,
	"generation_model" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding_dimensions" integer NOT NULL,
	"embedding_revision" integer DEFAULT 1 NOT NULL,
	"configured_by_user_id" uuid NOT NULL,
	"validated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_ai_configurations_dimensions_check" CHECK ("workspace_ai_configurations"."embedding_dimensions" = 1536),
	CONSTRAINT "workspace_ai_configurations_revision_check" CHECK ("workspace_ai_configurations"."embedding_revision" > 0),
	CONSTRAINT "workspace_ai_configurations_key_version_check" CHECK ("workspace_ai_configurations"."encryption_key_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "workspace_ai_configurations" ADD CONSTRAINT "workspace_ai_configurations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_ai_configurations" ADD CONSTRAINT "workspace_ai_configurations_configured_by_user_id_users_id_fk" FOREIGN KEY ("configured_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_ai_configurations_provider_idx" ON "workspace_ai_configurations" USING btree ("provider");