CREATE TABLE "retrieval_evaluation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"question" text NOT NULL,
	"expected_document_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval_evaluation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"case_id" uuid,
	"question_snapshot" text NOT NULL,
	"expected_document_id" uuid,
	"expected_document_title" text NOT NULL,
	"retrieved_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retrieval_mode" text NOT NULL,
	"reciprocal_rank" double precision NOT NULL,
	"was_hit" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval_evaluation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"case_count" integer NOT NULL,
	"hit_count" integer NOT NULL,
	"hit_rate" double precision NOT NULL,
	"mean_reciprocal_rank" double precision NOT NULL,
	"hybrid_case_count" integer NOT NULL,
	"keyword_only_case_count" integer NOT NULL,
	"top_k" integer NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_cases" ADD CONSTRAINT "retrieval_evaluation_cases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_cases" ADD CONSTRAINT "retrieval_evaluation_cases_expected_document_id_knowledge_documents_id_fk" FOREIGN KEY ("expected_document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_cases" ADD CONSTRAINT "retrieval_evaluation_cases_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_results" ADD CONSTRAINT "retrieval_evaluation_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_results" ADD CONSTRAINT "retrieval_evaluation_results_run_id_retrieval_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."retrieval_evaluation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_results" ADD CONSTRAINT "retrieval_evaluation_results_case_id_retrieval_evaluation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."retrieval_evaluation_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_results" ADD CONSTRAINT "retrieval_evaluation_results_expected_document_id_knowledge_documents_id_fk" FOREIGN KEY ("expected_document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_runs" ADD CONSTRAINT "retrieval_evaluation_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_evaluation_runs" ADD CONSTRAINT "retrieval_evaluation_runs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "retrieval_evaluation_cases_workspace_question_unique" ON "retrieval_evaluation_cases" USING btree ("workspace_id","question");--> statement-breakpoint
CREATE INDEX "retrieval_evaluation_cases_workspace_idx" ON "retrieval_evaluation_cases" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "retrieval_evaluation_results_run_idx" ON "retrieval_evaluation_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "retrieval_evaluation_results_workspace_idx" ON "retrieval_evaluation_results" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "retrieval_evaluation_runs_workspace_created_idx" ON "retrieval_evaluation_runs" USING btree ("workspace_id","created_at");