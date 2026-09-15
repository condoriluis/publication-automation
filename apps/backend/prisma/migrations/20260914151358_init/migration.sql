-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED', 'RESPONDED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('SUCCESS', 'FAILURE', 'PENDING');

-- CreateEnum
CREATE TYPE "CommentActionType" AS ENUM ('REPLY', 'HIDE', 'UNHIDE', 'DELETE', 'AI_REPLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('AUTH', 'FACEBOOK', 'CAMPAIGN', 'POST', 'COMMENT', 'AI', 'WEBHOOK', 'SYSTEM', 'SECURITY', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "replacedByTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorSecret" (
    "userId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "otpauthUrl" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "backupCodesEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwoFactorSecret_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "FacebookAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facebookUserId" TEXT NOT NULL,
    "facebookUserName" TEXT,
    "email" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'long-lived',
    "tokenExpiresAt" TIMESTAMP(3),
    "refreshTokenEncrypted" TEXT,
    "scopes" JSONB,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "pictureUrl" TEXT,
    "description" TEXT,
    "url" TEXT,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "accessTokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "PageStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageMetric" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "reachedCount" INTEGER NOT NULL DEFAULT 0,
    "impressionsCount" INTEGER NOT NULL DEFAULT 0,
    "engagedUsersCount" INTEGER NOT NULL DEFAULT 0,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "PageMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contentTemplate" TEXT NOT NULL,
    "imageUrls" JSONB,
    "videoUrl" TEXT,
    "groups" JSONB,
    "totalActions" INTEGER NOT NULL,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 5,
    "groupsWaitSeconds" INTEGER NOT NULL DEFAULT 1800,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "actionsDone" INTEGER NOT NULL DEFAULT 0,
    "actionsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metaPostId" TEXT,
    "dedupeKey" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiPrompt" TEXT,
    "aiProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignGroup" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 5,
    "waitAfterSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" "GroupStatus" NOT NULL DEFAULT 'PENDING',
    "actionsTarget" INTEGER NOT NULL DEFAULT 0,
    "actionsDone" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrls" JSONB,
    "videoUrl" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "metaObjectId" TEXT,
    "metaPermalinkUrl" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "dedupeKey" TEXT,
    "statusChangedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "metaCommentId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "fromName" TEXT,
    "parentId" TEXT,
    "message" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isFromPage" BOOLEAN NOT NULL DEFAULT false,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'NONE',
    "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentAction" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "type" "CommentActionType" NOT NULL,
    "payload" JSONB,
    "metaActionResult" JSONB,
    "status" "LogStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementMetric" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagements" INTEGER NOT NULL DEFAULT 0,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "EngagementMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "pageId" TEXT,
    "campaignId" TEXT,
    "postId" TEXT,
    "action" TEXT NOT NULL,
    "category" "LogCategory" NOT NULL DEFAULT 'SYSTEM',
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "context" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "apiKeyEncrypted" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "baseUrl" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "systemPrompt" TEXT NOT NULL DEFAULT 'You are a social media assistant.',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'day',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_revoked_idx" ON "Session"("userId", "revoked");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "FacebookAccount_userId_idx" ON "FacebookAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookAccount_userId_facebookUserId_key" ON "FacebookAccount"("userId", "facebookUserId");

-- CreateIndex
CREATE INDEX "Page_userId_idx" ON "Page"("userId");

-- CreateIndex
CREATE INDEX "Page_status_idx" ON "Page"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Page_accountId_facebookPageId_key" ON "Page"("accountId", "facebookPageId");

-- CreateIndex
CREATE INDEX "PageMetric_pageId_measuredAt_idx" ON "PageMetric"("pageId", "measuredAt");

-- CreateIndex
CREATE INDEX "Campaign_userId_status_idx" ON "Campaign"("userId", "status");

-- CreateIndex
CREATE INDEX "Campaign_status_startAt_idx" ON "Campaign"("status", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_pageId_dedupeKey_key" ON "Campaign"("pageId", "dedupeKey");

-- CreateIndex
CREATE INDEX "CampaignGroup_campaignId_idx" ON "CampaignGroup"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignGroup_campaignId_position_key" ON "CampaignGroup"("campaignId", "position");

-- CreateIndex
CREATE INDEX "Post_userId_status_idx" ON "Post"("userId", "status");

-- CreateIndex
CREATE INDEX "Post_pageId_publishedAt_idx" ON "Post"("pageId", "publishedAt");

-- CreateIndex
CREATE INDEX "Post_scheduledFor_idx" ON "Post"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "Post_pageId_dedupeKey_key" ON "Post"("pageId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_metaCommentId_key" ON "Comment"("metaCommentId");

-- CreateIndex
CREATE INDEX "Comment_pageId_createdAt_idx" ON "Comment"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_postId_idx" ON "Comment"("postId");

-- CreateIndex
CREATE INDEX "CommentAction_commentId_idx" ON "CommentAction"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementMetric_postId_key" ON "EngagementMetric"("postId");

-- CreateIndex
CREATE INDEX "EngagementMetric_postId_measuredAt_idx" ON "EngagementMetric"("postId", "measuredAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_campaignId_idx" ON "AuditLog"("campaignId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_userId_createdAt_idx" ON "DashboardSnapshot"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorSecret" ADD CONSTRAINT "TwoFactorSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookAccount" ADD CONSTRAINT "FacebookAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FacebookAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageMetric" ADD CONSTRAINT "PageMetric_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FacebookAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignGroup" ADD CONSTRAINT "CampaignGroup_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentAction" ADD CONSTRAINT "CommentAction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentAction" ADD CONSTRAINT "CommentAction_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMetric" ADD CONSTRAINT "EngagementMetric_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
