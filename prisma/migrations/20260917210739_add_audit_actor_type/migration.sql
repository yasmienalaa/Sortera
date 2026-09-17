-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('STAFF', 'RESEARCHER', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actor_type" "AuditActorType" NOT NULL DEFAULT 'STAFF';
