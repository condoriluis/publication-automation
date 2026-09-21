-- AlterTable
ALTER TABLE "EngagementMetric" ADD COLUMN "eligibleForPromotion" BOOLEAN;
ALTER TABLE "EngagementMetric" ADD COLUMN "restricted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EngagementMetric" ADD COLUMN "restrictionReason" TEXT;