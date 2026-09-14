import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const c = await prisma.campaign.findFirst({ where: { contentTemplate: 'Verify content' } });
  if (!c) {
    console.log('NO_CAMPAIGN');
    return;
  }
  const g = await prisma.campaignGroup.findFirst({ where: { campaignId: c.id } });
  const posts = await prisma.post.findMany({ where: { campaignId: c.id } });
  const counts: Record<string, number> = {};
  for (const x of posts) counts[x.status] = (counts[x.status] ?? 0) + 1;
  console.log(
    JSON.stringify(
      {
        campaignStatus: c.status,
        actionsDone: c.actionsDone,
        actionsFailed: c.actionsFailed,
        errorMessage: c.errorMessage,
        completedAt: c.completedAt,
        groups: await prisma.campaignGroup.count({ where: { campaignId: c.id } }),
        groupStatus: g?.status,
        groupActionsDone: g?.actionsDone,
        postsCreated: posts.length,
        postStatuses: counts,
      },
      null,
      1,
    ),
  );
}

main().finally(() => prisma.$disconnect());