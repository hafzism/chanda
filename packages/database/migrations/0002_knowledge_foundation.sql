CREATE TYPE "public"."knowledge_source_kind" AS ENUM('file', 'article');--> statement-breakpoint
CREATE TYPE "public"."knowledge_version_status" AS ENUM('queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"heading" text,
	"content" text NOT NULL,
	"content_hash" char(64) NOT NULL,
	"estimated_token_count" integer NOT NULL,
	"page_number" integer,
	"character_start" integer NOT NULL,
	"character_end" integer NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"original_filename" text,
	"mime_type" text NOT NULL,
	"object_key" text NOT NULL,
	"content_hash" char(64) NOT NULL,
	"byte_size" integer NOT NULL,
	"status" "knowledge_version_status" DEFAULT 'queued' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"embedding_provider" text,
	"embedding_model" text,
	"embedding_dimensions" integer,
	"error_code" text,
	"error_message" text,
	"indexed_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_kind" "knowledge_source_kind" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_version_id_knowledge_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."knowledge_document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_version_ordinal_unique" ON "knowledge_chunks" USING btree ("document_version_id","ordinal");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_workspace_idx" ON "knowledge_chunks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_document_idx" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_chunks_content_fts_idx" ON "knowledge_chunks" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_versions_document_version_unique" ON "knowledge_document_versions" USING btree ("document_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_versions_workspace_content_unique" ON "knowledge_document_versions" USING btree ("workspace_id","content_hash");--> statement-breakpoint
CREATE INDEX "knowledge_versions_workspace_status_idx" ON "knowledge_document_versions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_versions_document_idx" ON "knowledge_document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_documents_workspace_idx" ON "knowledge_documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "knowledge_documents_creator_idx" ON "knowledge_documents" USING btree ("created_by_user_id");
