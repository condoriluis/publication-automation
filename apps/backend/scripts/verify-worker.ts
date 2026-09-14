import 'reflect-metadata';
import { PrismaClient, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email: 'admin@example.com' } });
  if (!user) throw new Error('admin no existe');

  const account = await prisma.facebookAccount.upsert({
    where: { userId_facebookUserId: { userId: user.id, facebookUserId: 'verify' } },
    create: {
      userId: user.id,
      facebookUserId: 'verify',
      facebookUserName: 'Verify',
      email: null,
      accessTokenEncrypted: 'FAKE',
      tokenType: 'verify',
      tokenExpiresAt: null,
      scopes: [],
      status: 'ACTIVE',
    },
    update: {},
  });

  const page = await prisma.page.upsert({
    where: { accountId_facebookPageId: { accountId: account.id, facebookPageId: 'verify-page' } },
    create: {
      accountId: account.id,
      userId: user.id,
      facebookPageId: 'verify-page',
      name: 'Verify Page',
      accessTokenEncrypted: '',
      followersCount: 1,
      status: 'ACTIVE',
    },
    update: { accessTokenEncrypted: '', status: 'ACTIVE' },
  });

  const now = new Date();
  const stamp = now.getTime();

  await prisma.campaign.deleteMany({ where: { contentTemplate: 'Verify content' } });
  await prisma.post.deleteMany({ where: { content: 'Verify content' } });

  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      accountId: account.id,
      pageId: page.id,
      name: `Verify ${stamp}`,
      contentTemplate: 'Verify content',
      imageUrls: [],
      videoUrl: null,
      groups: [{ percentage: 100, intervalSeconds: 1, waitAfterSeconds: 1 }],
      totalActions: 6,
      intervalSeconds: 1,
      groupsWaitSeconds: 1,
      startAt: new Date(now.getTime() - 5 * 60_000),
      endsAt: new Date(now.getTime() + 60 * 60_000),
      aiGenerated: false,
      aiProvider: null,
      status: CampaignStatus.SCHEDULED,
      dedupeKey: `verify:${stamp}`,
    },
  });

  console.log(JSON.stringify({ campaignId: campaign.id, status: campaign.status, startAt: campaign.startAt }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());