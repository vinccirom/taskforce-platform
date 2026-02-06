-- AlterEnum: Add new enum values
CREATE TYPE "WorkerType" AS ENUM ('HUMAN', 'AGENT', 'HYBRID');
CREATE TYPE "PaymentType" AS ENUM ('FIXED', 'MILESTONE');
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'DISPUTED');

-- Add DISPUTED to TaskStatus (rename TestStatus later)
ALTER TYPE "TestStatus" ADD VALUE 'DISPUTED';

-- Rename Test table to Task
ALTER TABLE "Test" RENAME TO "Task";

-- Rename TestStatus enum to TaskStatus
ALTER TYPE "TestStatus" RENAME TO "TaskStatus";

-- Add new columns to Task table with default values
ALTER TABLE "Task" ADD COLUMN "referenceUrl" TEXT;
ALTER TABLE "Task" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'qa-testing';
ALTER TABLE "Task" ADD COLUMN "skillsRequired" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Task" ADD COLUMN "totalBudget" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "paymentType" "PaymentType" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Task" ADD COLUMN "paymentPerWorker" DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN "maxWorkers" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Task" ADD COLUMN "currentWorkers" INTEGER NOT NULL DEFAULT 0;

-- Copy data from old columns to new columns
UPDATE "Task" SET "totalBudget" = "paymentPerAgent" * "maxAgents";
UPDATE "Task" SET "paymentPerWorker" = "paymentPerAgent";
UPDATE "Task" SET "maxWorkers" = "maxAgents";
UPDATE "Task" SET "currentWorkers" = "currentAgents";
UPDATE "Task" SET "referenceUrl" = "productUrl";

-- Map old modality to new category
UPDATE "Task" SET "category" =
  CASE
    WHEN "modality" = 'FUNCTIONAL' THEN 'qa-testing'
    WHEN "modality" = 'BUG_BOUNTY' THEN 'qa-testing'
    WHEN "modality" = 'MARKET_VALIDATION' THEN 'market-research'
    ELSE 'qa-testing'
  END;

-- Rename columns in Task table
ALTER TABLE "Task" RENAME COLUMN "productUrl" TO "productUrl_old";
ALTER TABLE "Task" RENAME COLUMN "testCredentials" TO "credentials";
ALTER TABLE "Task" DROP COLUMN "modality";
ALTER TABLE "Task" DROP COLUMN "paymentPerAgent";
ALTER TABLE "Task" DROP COLUMN "maxAgents";
ALTER TABLE "Task" DROP COLUMN "currentAgents";
ALTER TABLE "Task" DROP COLUMN "productUrl_old";

-- Update Application table references
ALTER TABLE "Application" RENAME COLUMN "testId" TO "taskId";

-- Update Submission table references
ALTER TABLE "Submission" RENAME COLUMN "testId" TO "taskId";
ALTER TABLE "Submission" RENAME COLUMN "bugReports" TO "deliverable";
ALTER TABLE "Submission" DROP COLUMN "personaUsed";

-- Add workerType to Agent table
ALTER TABLE "Agent" ADD COLUMN "workerType" "WorkerType" NOT NULL DEFAULT 'AGENT';

-- Create Milestone table
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "deliverable" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- Add milestoneId to Evidence table
ALTER TABLE "Evidence" ADD COLUMN "milestoneId" TEXT;
ALTER TABLE "Evidence" ALTER COLUMN "submissionId" DROP NOT NULL;

-- Create indexes
CREATE INDEX "Milestone_taskId_idx" ON "Milestone"("taskId");
CREATE INDEX "Evidence_milestoneId_idx" ON "Evidence"("milestoneId");

-- Add foreign key constraints
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old TestModality enum (no longer used)
DROP TYPE "TestModality";
