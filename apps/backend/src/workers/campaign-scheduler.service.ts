import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CampaignStatus, GroupStatus, LogCategory, PostStatus } from '@prisma/client';

import { AppLogger } from '../common/logger/app-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../modules/audit/audit.service';
import { CampaignExecutorService } from './campaign-executor.service';

/**
 * Scheduler de campañas sobre PostgreSQL.
 *
 * Cada tick (todos los procesos lo corren) intenta:
 *  1) Activar campañas SCHEDULED cuyo startAt ya venció (claim atómico por
 *     status, de modo que un solo proceso materializa los grupos).
 *  2) Completar campañas RUNNING cuyo endsAt ya venció.
 *  3) Liberar leases vencidos de grupos (recuperación tras caída de un worker).
 *
 * No usa colas externas: la "cola" es la propia base de datos y el avance lo
 * hace el CampaignWorkerService reclamando grupos con updateMany condicional.
 */
@Injectable()
export class CampaignSchedulerService {
  static readonly INTERVAL_MS = 15_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: CampaignExecutorService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  @Interval('campaign-scheduler', CampaignSchedulerService.INTERVAL_MS)
  async tick(): Promise<void> {
    const now = new Date();
    await this.activateDueCampaigns(now);
    await this.completeExpiredCampaigns(now);
    await this.releaseStaleLeases(now);
  }

  // ---------------------------------------------------------------------------

  private async activateDueCampaigns(now: Date): Promise<void> {
    const due = await this.prisma.campaign.findMany({
      where: { status: CampaignStatus.SCHEDULED, startAt: { lte: now } },
      take: 50,
      select: { id: true, name: true },
    });

    for (const campaign of due) {
      // Claim atómico: solo el proceso que gane pasa de SCHEDULED a RUNNING.
      const claimed = await this.prisma.campaign.updateMany({
        where: { id: campaign.id, status: CampaignStatus.SCHEDULED, startAt: { lte: now } },
        data: { status: CampaignStatus.RUNNING, errorMessage: null },
      });
      if (claimed.count !== 1) continue;

      await this.executor.activateCampaignGroups(campaign.id);
      await this.audit.record({
        action: 'campaign.activated',
        category: LogCategory.CAMPAIGN,
        campaignId: campaign.id,
      });
      this.logger.log(`Campaña ${campaign.id} (${campaign.name}) activada`);
    }
  }

  private async completeExpiredCampaigns(now: Date): Promise<void> {
    const expired = await this.prisma.campaign.findMany({
      where: { status: CampaignStatus.RUNNING, endsAt: { lte: now } },
      take: 50,
      select: { id: true, name: true },
    });

    for (const campaign of expired) {
      // Claim atómico RUNNING -> COMPLETED (completedAt provisional).
      const claimed = await this.prisma.campaign.updateMany({
        where: { id: campaign.id, status: CampaignStatus.RUNNING, endsAt: { lte: now } },
        data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
      });
      if (claimed.count !== 1) continue;

      // Limpieza terminal idempotente (el ganador del claim la ejecuta).
      await this.prisma.post.updateMany({
        where: {
          campaignId: campaign.id,
          status: { in: [PostStatus.SCHEDULED, PostStatus.PUBLISHING, PostStatus.DRAFT] },
        },
        data: { status: PostStatus.CANCELLED },
      });
      await this.prisma.campaignGroup.updateMany({
        where: { campaignId: campaign.id },
        data: { status: GroupStatus.COMPLETED, finishedAt: new Date(), leaseExpiresAt: null },
      });
      await this.audit.record({
        action: 'campaign.completed',
        category: LogCategory.CAMPAIGN,
        campaignId: campaign.id,
        metadata: { via: 'endsAt' },
      });
      await this.logger.log(`Campaña ${campaign.id} (${campaign.name}) finalizada por endsAt`);
    }
  }

  private async releaseStaleLeases(now: Date): Promise<void> {
    // Libera leases vencidos: el worker que los tenía cayó y otro puede tomarlos.
    const released = await this.prisma.campaignGroup.updateMany({
      where: {
        status: { in: [GroupStatus.PENDING, GroupStatus.RUNNING] },
        leaseExpiresAt: { lte: now },
        campaign: { status: CampaignStatus.RUNNING },
      },
      data: { leaseExpiresAt: null },
    });
    if (released.count > 0) {
      this.logger.warn(`Scheduler: ${released.count} leases vencidos liberados`);
    }
  }
}