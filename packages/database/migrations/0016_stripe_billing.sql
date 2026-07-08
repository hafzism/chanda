CREATE TYPE "public"."billing_subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"event_created_at" timestamp with time zone NOT NULL,
	"workspace_id" uuid,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_billing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"subscription_status" "billing_subscription_status",
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"latest_stripe_event_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_billing_accounts" ADD CONSTRAINT "workspace_billing_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_workspace_idx" ON "stripe_webhook_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_created_idx" ON "stripe_webhook_events" USING btree ("event_created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_accounts_workspace_unique" ON "workspace_billing_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_accounts_customer_unique" ON "workspace_billing_accounts" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_accounts_subscription_unique" ON "workspace_billing_accounts" USING btree ("stripe_subscription_id") WHERE "workspace_billing_accounts"."stripe_subscription_id" is not null;
