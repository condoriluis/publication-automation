-- AlterTable
ALTER TABLE "CampaignGroup" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "nextRunAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CampaignGroup_status_nextRunAt_idx" ON "CampaignGroup"("status", "nextRunAt");
