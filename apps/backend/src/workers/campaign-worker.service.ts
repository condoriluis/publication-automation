import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Campaign, CampaignStatus, GroupStatus, PostStatus } from '@prisma/client';

import { AppLogger } from '../common/logger/app-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignExecutorService } from './campaign-executor.service';
import { AiService } from '../modules/ai/ai.service';

interface GroupRow {
  id: string;
  position: number;
  actionsTarget: number;
  actionsDone: number;
  intervalSeconds: number;
  waitAfterSeconds: number;
  campaignId: string;
  campaign: Campaign;
}

@Injectable()
export class CampaignWorkerService {
  private static readonly INTERVAL_MS = 5_000;

  private readonly leaseMs: number;
  private readonly maxAttempts: number;
  private readonly retryBackoffMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: CampaignExecutorService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    private readonly aiService: AiService,
  ) {
    this.leaseMs = toInt(this.config.get<string>('WORKER_LEASE_MS'), 60_000);
    this.maxAttempts = toInt(this.config.get<string>('WORKER_MAX_ATTEMPTS'), 5);
    this.retryBackoffMs = toInt(this.config.get<string>('WORKER_RETRY_BACKOFF_MS'), 30_000);
  }

  @Interval('campaign-worker', CampaignWorkerService.INTERVAL_MS)
  async tick(): Promise<void> {
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.error(`Worker tick falló: ${(err as Error).message}`, undefined, 'CampaignWorker');
    }
  }

  private async runOnce(): Promise<void> {
    const now = new Date();
    const concurrency = toInt(this.config.get<string>('WORKER_CONCURRENCY'), 10);

    const due = await this.prisma.campaignGroup.findMany({
      where: {
        status: { in: [GroupStatus.PENDING, GroupStatus.RUNNING] },
        campaign: { status: CampaignStatus.RUNNING },
        AND: [
          { OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
          { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
        ],
      },
      orderBy: [{ nextRunAt: 'asc' }, { position: 'asc' }],
      take: concurrency,
      select: { id: true },
    });

    for (const { id } of due) {
      if (!(await this.tryClaim(id, now))) continue;
      try {
        await this.processGroup(id);
      } catch (err) {
        this.logger.error(`Grupo ${id} falló: ${(err as Error).message}`, undefined, 'CampaignWorker');
      }
    }
  }

  private async tryClaim(groupId: string, now: Date): Promise<boolean> {
    const claimed = await this.prisma.campaignGroup.updateMany({
      where: {
        id: groupId,
        status: { in: [GroupStatus.PENDING, GroupStatus.RUNNING] },
        campaign: { status: CampaignStatus.RUNNING },
        AND: [
          { OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
          { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
        ],
      },
      data: { status: GroupStatus.RUNNING, leaseExpiresAt: new Date(now.getTime() + this.leaseMs) },
    });
    if (claimed.count !== 1) return false;

    await this.prisma.campaignGroup.updateMany({
      where: { id: groupId, startedAt: null },
      data: { startedAt: now },
    });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Ejecución de un grupo reclamado
  // ---------------------------------------------------------------------------

  private async processGroup(groupId: string): Promise<void> {
    const group = await this.prisma.campaignGroup.findUnique({
      where: { id: groupId },
      include: { campaign: true },
    }) as unknown as GroupRow | null;
    if (!group) return;

    // La campaña salió de RUNNING (pausa/cancel) mientras reclamábamos: liberar.
    if (group.campaign.status !== CampaignStatus.RUNNING) {
      await this.release(groupId);
      return;
    }

    const now = Date.now();

    // 1) Asegurar que existen los Posts del grupo (idempotente por dedupeKey + P2002).
    await this.ensureGroupPosts(group);

    // 2) Tomar el primer post pendiente y publicarlo.
    const post = await this.nextPendingPost(group.campaignId, group.id);
    if (!post) {
      await this.finishGroupOrAdvance(group);
      await this.release(groupId);
      return;
    }

    let result;
    try {
      result = await this.executor.publishPostToFacebook(post.id, post.pageId);
    } catch (err) {
      const attempts = await this.incrementAttempts(groupId, now + this.retryBackoffMs);
      this.logger.warn(
        `Grupo ${groupId}: error transitorio en post ${post.id} (intento ${attempts}): ${(err as Error).message}`,
      );
      return;
    }

    if (result.status === 'published') {
      const updated = await this.prisma.campaignGroup.update({
        where: { id: groupId },
        data: { actionsDone: { increment: 1 }, attempts: 0 },
      });
      if (updated.actionsDone >= updated.actionsTarget) {
        await this.finishGroupOrAdvance(updated as unknown as GroupRow);
        return; // ya soltó el lease dentro
      }
      await this.prisma.campaignGroup.update({
        where: { id: groupId },
        data: { nextRunAt: new Date(now + group.intervalSeconds * 1000), leaseExpiresAt: null },
      });
      return;
    }

    if (result.status === 'failed-permanent') {
      const campaign = await this.prisma.campaign.findUnique({ where: { id: group.campaignId } });
      if (campaign?.actionsFailed == null) return;
      if (campaign.actionsFailed >= this.maxAttempts && campaign.actionsDone === 0) {
        await this.executor.markCampaignFailure(group.campaignId, 'Demasiados fallos permanentes al publicar');
        return;
      }

      await this.prisma.campaignGroup.update({
        where: { id: groupId },
        data: { attempts: { increment: 1 }, nextRunAt: new Date(now + 2_000), leaseExpiresAt: null },
      });
      return;
    }

    await this.prisma.campaignGroup.update({
      where: { id: groupId },
      data: { nextRunAt: new Date(now + 5_000), leaseExpiresAt: null },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers de grupo
  // ---------------------------------------------------------------------------

  private async ensureGroupPosts(group: GroupRow): Promise<void> {
    let created = 0;

    for (let i = 0; i < group.actionsTarget; i++) {
      const dedupeKey = `campaign:${group.campaignId}:${group.id}:${i}:${group.campaign.pageId}`;

      // Chequear primero si ya existe para no gastar tokens de IA en vano
      const existing = await this.prisma.post.findFirst({ where: { dedupeKey } });
      if (existing) {
        created += 1;
        continue;
      }

      let content = group.campaign.contentTemplate;

      // Si la campaña tiene IA activada, generamos un post nuevo dinámicamente
      if (group.campaign.aiGenerated) {
        try {
          const page = await this.prisma.page.findUnique({ where: { id: group.campaign.pageId } });
          if (page) {
            this.logger.debug(`Generando post dinámico con IA para el grupo ${group.id}`);
            content = await this.aiService.generatePostText({
              page,
              theme: group.campaign.contentTemplate,
              length: 'medium',
            });
          }
        } catch (err) {
          this.logger.error(`Error generando post con IA en la campaña automatizada: ${err instanceof Error ? err.message : String(err)}`);
          // Hacemos un fallo silencioso aquí para usar el contentTemplate original en lugar de bloquear todo
        }
      }

      try {
        await this.prisma.post.create({
          data: {
            campaignId: group.campaignId,
            userId: group.campaign.userId,
            pageId: group.campaign.pageId,
            content,
            imageUrls: (group.campaign.imageUrls as string[] | null) ?? [],
            videoUrl: group.campaign.videoUrl,
            status: PostStatus.SCHEDULED,
            aiGenerated: group.campaign.aiGenerated,
            aiProvider: group.campaign.aiProvider,
            dedupeKey,
          },
        });
        created += 1;
      } catch (err) {
        if (isDuplicateKey(err)) continue; // ya creado en un intento previo
        throw err;
      }
    }

    if (created > 0) {
      this.logger.debug(`${created} posts asegurados para el grupo ${group.id}`);
    }
  }

  private async nextPendingPost(
    campaignId: string,
    groupId: string,
  ): Promise<{ id: string; pageId: string } | null> {
    return this.prisma.post.findFirst({
      where: {
        campaignId,
        dedupeKey: { startsWith: `campaign:${campaignId}:${groupId}:` },
        status: { in: [PostStatus.SCHEDULED, PostStatus.PUBLISHING] },
      },
      orderBy: { statusChangedAt: 'asc' },
      select: { id: true, pageId: true },
    });
  }

  private async finishGroupOrAdvance(group: GroupRow): Promise<void> {
    const failed = await this.prisma.post.count({
      where: {
        campaignId: group.campaignId,
        dedupeKey: { startsWith: `campaign:${group.campaignId}:${group.id}:` },
        status: PostStatus.FAILED,
      },
    });
    const lastAttempt = group.actionsTarget === 0 || group.actionsDone + failed >= group.actionsTarget;
    if (!lastAttempt) {
      // Aún hay acción por completar sin posts pendientes: pedir próximo tick.
      await this.prisma.campaignGroup.update({
        where: { id: group.id },
        data: { nextRunAt: new Date(Date.now() + 5_000), leaseExpiresAt: null },
      });
      return;
    }

    // Grupo terminado: marcar COMPLETED y soltar lease.
    const now = new Date();
    await this.prisma.campaignGroup.update({
      where: { id: group.id },
      data: { status: GroupStatus.COMPLETED, finishedAt: now, leaseExpiresAt: null },
    });

    // Activar el siguiente grupo respetando waitAfterSeconds.
    const next = await this.prisma.campaignGroup.findFirst({
      where: { campaignId: group.campaignId, position: { gt: group.position }, status: { not: GroupStatus.COMPLETED } },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    if (next) {
      await this.prisma.campaignGroup.update({
        where: { id: next.id },
        data: {
          status: GroupStatus.PENDING,
          nextRunAt: new Date(now.getTime() + group.waitAfterSeconds * 1000),
          leaseExpiresAt: null,
        },
      });
      return;
    }

    // Último grupo: completar la campaña si es el caso.
    const campaign = await this.prisma.campaign.findUnique({ where: { id: group.campaignId } });
    if (campaign && (campaign.actionsDone >= campaign.totalActions || (campaign.endsAt && campaign.endsAt <= now))) {
      await this.executor.finalizeCampaign(campaign.id);
    }
  }

  private async incrementAttempts(groupId: string, nextRunAtMs: number): Promise<number> {
    const updated = await this.prisma.campaignGroup.update({
      where: { id: groupId },
      data: { attempts: { increment: 1 }, nextRunAt: new Date(nextRunAtMs), leaseExpiresAt: null },
    });
    return updated.attempts;
  }

  private async release(groupId: string): Promise<void> {
    await this.prisma.campaignGroup.update({
      where: { id: groupId },
      data: { leaseExpiresAt: null },
    });
  }
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = value === undefined || value === '' ? NaN : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}