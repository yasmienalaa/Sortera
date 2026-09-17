-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'SUPER_ADMIN', 'ADMIN', 'MEDIA_ADMIN', 'RESEARCHER');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'IMAGE', 'DOCUMENT', 'AUDIO');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('ACTIVE', 'PENDING_REVIEW', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "LifecycleStatus" AS ENUM ('RAW', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfidentialityLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('SAME_EVENT', 'SAME_PERSON', 'SAME_LOCATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "PredictionType" AS ENUM ('CHARACTER', 'TEXT', 'VIDEO_PROCESSING', 'BRAND');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MergeSuggestionStatus" AS ENUM ('PENDING', 'MERGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "RetentionAction" AS ENUM ('ARCHIVE', 'DELETE', 'NOTIFY_ONLY');

-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('VIEW', 'EDIT');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WatermarkStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "enforce_two_factor_for_roles" "Role"[] DEFAULT ARRAY['OWNER', 'SUPER_ADMIN', 'ADMIN', 'MEDIA_ADMIN']::"Role"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEDIA_ADMIN',
    "two_factor_enforced" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "lifecycle_status" "LifecycleStatus" NOT NULL DEFAULT 'RAW',
    "confidentiality_level" "ConfidentialityLevel" NOT NULL DEFAULT 'INTERNAL',
    "event_id" TEXT,
    "event_type_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "retention_expiry_date" TIMESTAMP(3),
    "applied_retention_policy" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_vector" tsvector,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action_type" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_relations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation_type" "RelationType" NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_transitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "from_status" "LifecycleStatus" NOT NULL,
    "to_status" "LifecycleStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_predictions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "prediction_type" "PredictionType" NOT NULL,
    "predicted_value" JSONB NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "status" "PredictionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_merge_suggestions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "record_id_a" TEXT NOT NULL,
    "record_id_b" TEXT NOT NULL,
    "similarity_score" DOUBLE PRECISION NOT NULL,
    "status" "MergeSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,

    CONSTRAINT "pending_merge_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nav_sections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" "Role",
    "section_name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nav_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_revisions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "version_number" INTEGER NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_info" TEXT,
    "ip" TEXT,
    "last_active" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_token_hash" TEXT NOT NULL,
    "two_factor_trusted_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query_params" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "total_by_content_type" JSONB NOT NULL,
    "pending_ai_review" INTEGER NOT NULL,
    "storage_used_bytes" BIGINT NOT NULL,
    "recent_additions" JSONB NOT NULL,
    "restricted_alerts" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_files" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "page_count" INTEGER,
    "ocr_status" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "ocr_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "retention_period_days" INTEGER NOT NULL,
    "action_on_expiry" "RetentionAction" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_resources" (
    "id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "permission_level" "SharePermission" NOT NULL,
    "shared_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "researcher_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "researcher_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watermark_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_item_id" TEXT NOT NULL,
    "researcher_id" TEXT NOT NULL,
    "status" "WatermarkStatus" NOT NULL DEFAULT 'PENDING',
    "storage_path" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watermark_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "content_items_tenant_id_idx" ON "content_items"("tenant_id");

-- CreateIndex
CREATE INDEX "content_items_tenant_id_content_type_idx" ON "content_items"("tenant_id", "content_type");

-- CreateIndex
CREATE INDEX "content_items_tenant_id_confidentiality_level_idx" ON "content_items"("tenant_id", "confidentiality_level");

-- CreateIndex
CREATE INDEX "content_items_tenant_id_event_id_idx" ON "content_items"("tenant_id", "event_id");

-- CreateIndex
CREATE INDEX "content_items_search_idx" ON "content_items" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_resource_type_resource_id_idx" ON "audit_logs"("tenant_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_timestamp_idx" ON "audit_logs"("tenant_id", "timestamp");

-- CreateIndex
CREATE INDEX "content_relations_tenant_id_idx" ON "content_relations"("tenant_id");

-- CreateIndex
CREATE INDEX "content_relations_tenant_id_source_id_idx" ON "content_relations"("tenant_id", "source_id");

-- CreateIndex
CREATE INDEX "status_transitions_tenant_id_idx" ON "status_transitions"("tenant_id");

-- CreateIndex
CREATE INDEX "status_transitions_tenant_id_content_item_id_idx" ON "status_transitions"("tenant_id", "content_item_id");

-- CreateIndex
CREATE INDEX "ai_predictions_tenant_id_idx" ON "ai_predictions"("tenant_id");

-- CreateIndex
CREATE INDEX "ai_predictions_tenant_id_status_idx" ON "ai_predictions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "ai_predictions_tenant_id_resource_id_idx" ON "ai_predictions"("tenant_id", "resource_id");

-- CreateIndex
CREATE INDEX "pending_merge_suggestions_tenant_id_idx" ON "pending_merge_suggestions"("tenant_id");

-- CreateIndex
CREATE INDEX "pending_merge_suggestions_tenant_id_status_idx" ON "pending_merge_suggestions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "event_types_tenant_id_idx" ON "event_types"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_types_tenant_id_name_parent_id_key" ON "event_types"("tenant_id", "name", "parent_id");

-- CreateIndex
CREATE INDEX "nav_sections_tenant_id_idx" ON "nav_sections"("tenant_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_idx" ON "tasks"("tenant_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_researcher_id_idx" ON "tasks"("tenant_id", "researcher_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_status_idx" ON "tasks"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "event_revisions_tenant_id_idx" ON "event_revisions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_revisions_resource_id_version_number_key" ON "event_revisions"("resource_id", "version_number");

-- CreateIndex
CREATE INDEX "active_sessions_tenant_id_idx" ON "active_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "active_sessions_tenant_id_user_id_idx" ON "active_sessions"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "active_sessions_session_token_hash_idx" ON "active_sessions"("session_token_hash");

-- CreateIndex
CREATE INDEX "saved_searches_tenant_id_idx" ON "saved_searches"("tenant_id");

-- CreateIndex
CREATE INDEX "saved_searches_tenant_id_user_id_idx" ON "saved_searches"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "dashboard_snapshots_tenant_id_computed_at_idx" ON "dashboard_snapshots"("tenant_id", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_files_content_item_id_key" ON "document_files"("content_item_id");

-- CreateIndex
CREATE INDEX "document_files_tenant_id_idx" ON "document_files"("tenant_id");

-- CreateIndex
CREATE INDEX "document_files_tenant_id_ocr_status_idx" ON "document_files"("tenant_id", "ocr_status");

-- CreateIndex
CREATE INDEX "retention_policies_tenant_id_idx" ON "retention_policies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_tenant_id_content_type_key" ON "retention_policies"("tenant_id", "content_type");

-- CreateIndex
CREATE INDEX "shared_resources_tenant_id_idx" ON "shared_resources"("tenant_id");

-- CreateIndex
CREATE INDEX "shared_resources_content_item_id_idx" ON "shared_resources"("content_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_resources_content_item_id_tenant_id_key" ON "shared_resources"("content_item_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_content_item_id_key" ON "media_files"("content_item_id");

-- CreateIndex
CREATE INDEX "media_files_tenant_id_idx" ON "media_files"("tenant_id");

-- CreateIndex
CREATE INDEX "researcher_accounts_tenant_id_idx" ON "researcher_accounts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "researcher_accounts_tenant_id_email_key" ON "researcher_accounts"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "access_requests_tenant_id_idx" ON "access_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "access_requests_tenant_id_status_idx" ON "access_requests"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_researcher_id_resource_id_key" ON "access_requests"("researcher_id", "resource_id");

-- CreateIndex
CREATE INDEX "watermark_jobs_tenant_id_idx" ON "watermark_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "watermark_jobs_expires_at_idx" ON "watermark_jobs"("expires_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_relations" ADD CONSTRAINT "content_relations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_relations" ADD CONSTRAINT "content_relations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nav_sections" ADD CONSTRAINT "nav_sections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_revisions" ADD CONSTRAINT "event_revisions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_resources" ADD CONSTRAINT "shared_resources_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_researcher_id_fkey" FOREIGN KEY ("researcher_id") REFERENCES "researcher_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
