import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { LogCategory, PostStatus } from '@prisma/client';

import { AppLogger } from '../common/logger/app-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../modules/audit/audit.service';
import { CampaignExecutorService } from './campaign-executor.service';

/**
 * Publica de forma autónoma los posts "sueltos" (sin campaña) que el usuario
 * programó en frontend con `scheduledFor`. Corre in-process vía @Interval
 * (mismo patrón que campaign-worker) y compite por claims atómicos en
 * PostgreSQL, por lo que es seguro ejecutarlo en varios procesos a la vez.
 */
@Injectable()
export class ScheduledPostPublisherService {
  private static readonly INTERVAL_MS = 15_000;

  private readonly concurrency: number;
  private readonly maxAttempts: number;
  /** Evita ticks solapados (mismo patrón que comment-worker/comment-poll). */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: CampaignExecutorService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.concurrency = toInt(this.config.get<string>('WORKER_CONCURRENCY'), 10);
    this.maxAttempts = toInt(this.config.get<string>('WORKER_MAX_ATTEMPTS'), 5);
  }

  @Interval('scheduled-post-publisher', ScheduledPostPublisherService.INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.error(
        `Tick de posts programados falló: ${(err as Error).message}`,
        undefined,
        'ScheduledPostPublisher',
      );
    } finally {
      this.running = false;
    }
  }

  private async runOnce(): Promise<void> {
    const due = await this.prisma.post.findMany({
      where: {
        campaignId: null,
        status: PostStatus.SCHEDULED,
        scheduledFor: { lte: new Date() },
      },
      orderBy: { scheduledFor: 'asc' },
      take: this.concurrency,
      select: { id: true, pageId: true },
    });

    if (due.length === 0) return;

    for (const post of due) {
      if (!(await this.tryClaim(post.id))) continue;
      try {
        const result = await this.executor.publishPostToFacebook(post.id, post.pageId);
        if (result.status === 'published' || result.status === 'already-published') {
          await this.prisma.post.update({
            where: { id: post.id },
            data: { publishAttempts: 0 },
          });
        } else if (result.status === 'skipped') {
          // Estado mutado por otra vía (cancel/borrado) mientras reclamábamos: liberar.
          await this.prisma.post.updateMany({
            where: { id: post.id, status: PostStatus.PUBLISHING },
            data: { status: PostStatus.SCHEDULED },
          });
        }
      } catch (err) {
        await this.recordTransientFailure(post.id, post.pageId, err as Error);
      }
    }
  }

  /** Claim atómico: solo un proceso publica cada post (idempotencia por estado). */
  private async tryClaim(postId: string): Promise<boolean> {
    const claimed = await this.prisma.post.updateMany({
      where: { id: postId, status: PostStatus.SCHEDULED },
      data: { status: PostStatus.PUBLISHING },
    });
    return claimed.count === 1;
  }

  /** Fallo transitorio (red/429): se reintenta hasta superar maxAttempts → FAILED. */
  private async recordTransientFailure(postId: string, pageId: string, err: Error): Promise<void> {
    const updated = await this.prisma.post.updateMany({
      where: { id: postId, status: PostStatus.PUBLISHING },
      data: { publishAttempts: { increment: 1 } },
    });
    if (updated.count !== 1) return;

    const attempts = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { publishAttempts: true },
    });

    if (attempts && attempts.publishAttempts >= this.maxAttempts) {
      await this.prisma.post.update({ where: { id: postId }, data: { status: PostStatus.FAILED } });
      await this.audit.record({
        action: 'post.publish_failed',
        category: LogCategory.POST,
        pageId,
        postId,
        metadata: { message: `Superó ${this.maxAttempts} intentos de publicación automática` },
      });
      this.logger.error(
        `Post ${postId} marcado FAILED por superar ${this.maxAttempts} intentos transitorios`,
        undefined,
        'ScheduledPostPublisher',
      );
      return;
    }

    await this.prisma.post.update({ where: { id: postId }, data: { status: PostStatus.SCHEDULED } });
    this.logger.warn(
      `Post ${postId}: error transitorio (intento ${attempts?.publishAttempts}): ${err.message}`,
      undefined,
      'ScheduledPostPublisher',
    );
  }
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = value === undefined || value === '' ? NaN : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}