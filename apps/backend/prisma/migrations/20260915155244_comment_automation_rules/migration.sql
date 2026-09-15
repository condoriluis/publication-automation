-- CreateEnum
CREATE TYPE "CommentClassification" AS ENUM ('INSULTO', 'PREGUNTA', 'SPAM', 'NORMAL', 'OPORTUNIDAD');

-- CreateEnum
CREATE TYPE "CommentRuleAction" AS ENUM ('REPLY', 'HIDE', 'DELETE', 'FLAG_REVIEW');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "classification" "CommentClassification",
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CommentAction" ADD COLUMN     "executeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CommentRule" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "keywords" JSONB,
    "classifications" JSONB,
    "maxConfidence" INTEGER,
    "action" "CommentRuleAction" NOT NULL DEFAULT 'REPLY',
    "replyTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentRule_pageId_idx" ON "CommentRule"("pageId");

-- CreateIndex
CREATE INDEX "Comment_needsReview_idx" ON "Comment"("needsReview");

-- CreateIndex
CREATE INDEX "CommentAction_status_executeAt_idx" ON "CommentAction"("status", "executeAt");

-- AddForeignKey
ALTER TABLE "CommentRule" ADD CONSTRAINT "CommentRule_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
