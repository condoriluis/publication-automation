import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { LogCategory } from '@prisma/client';

import { AppLogger } from '../../common/logger/app-logger.service';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommentsService } from './comments.service';

/**
 * Sondeo periódico de comentarios desde la Graph API de Meta.
 *
 * Alternativa (y suplencia) a los webhooks: mientras la app no está
 * publicada, Meta no entrega webhooks de datos reales, así que este worker
 * re-descarga los comentarios de los posts recientes cada N minutos.
 *
 * Diseño:
 * - Un solo ciclo activo a la vez (candado `running`).
 * - Solo toca páginas ACTIVAS con posts publicados dentro de la ventana.
 * - Reutiliza la ingestión idempotente de CommentsService (upsert por
 *   metaCommentId); los comentarios nuevos pasan por la automatización.
 * - Pausa breve entre páginas para no golpear el rate limit de Meta y
 *   aisla cada página: un fallo no cancela el resto del ciclo.
 * - Registra un rastro de auditoría `comment.poll` por página.
 */
@Injectable()
export class CommentPollWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly POLL_NAME = 'comment-poll';
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly comments: CommentsService,
    private readonly audit: AuditService,
    private readonly appConfig: AppConfigService,
    private readonly scheduler: SchedulerRegistry,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.appConfig.commentPollIntervalMs;
    this.scheduler.addInterval(this.POLL_NAME, setInterval(() => void this.tick(), intervalMs));
    this.logger.log(
      `Sondeo automático de comentarios activo: cada ${Math.round(intervalMs / 60_000)} min, ` +
        `ventana ${this.appConfig.commentPollWindowHours}h, máx ${this.appConfig.commentPollMaxPosts} posts/página`,
      'CommentPoll',
    );
  }

  onModuleDestroy(): void {
    this.scheduler.deleteInterval(this.POLL_NAME);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.pollOnce();
    } catch (err) {
      this.logger.warn(
        `Ciclo de sondeo de comentarios fallido: ${err instanceof Error ? err.message : String(err)}`,
        'CommentPoll',
      );
    } finally {
      this.running = false;
    }
  }

  private async pollOnce(): Promise<void> {
    const windowHours = this.appConfig.commentPollWindowHours;
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const pages = await this.prisma.page.findMany({
      where: {
        status: 'ACTIVE',
        posts: { some: { metaObjectId: { not: null }, publishedAt: { gte: cutoff } } },
      },
      select: { id: true, userId: true, name: true },
      orderBy: { id: 'asc' },
    });

    for (const page of pages) {
      try {
        const posts = await this.prisma.post.findMany({
          where: { pageId: page.id, metaObjectId: { not: null }, publishedAt: { gte: cutoff } },
          orderBy: { publishedAt: 'desc' },
          take: this.appConfig.commentPollMaxPosts,
          select: { id: true, pageId: true, metaObjectId: true },
        });

        let synced = 0;
        let skipped = 0;
        for (const post of posts) {
          const result = await this.comments.syncFromMeta(post);
          synced += result.synced;
          skipped += result.skipped;
        }

        if (synced > 0 || skipped > 0) {
          this.logger.log(
            `Sondeo "${page.name}": ${synced} nuevos, ${skipped} ya respondidos (${posts.length} posts)`,
            'CommentPoll',
          );
        }

        await this.audit.record({
          action: 'comment.poll',
          category: LogCategory.COMMENT,
          userId: page.userId,
          pageId: page.id,
          metadata: { posts: posts.length, synced, skipped },
        });

        await this.sleep(this.appConfig.commentPollPageDelayMs);
      } catch (err) {
        this.logger.warn(
          `Sondeo de comentarios de "${page.name}" fallido: ${err instanceof Error ? err.message : String(err)}`,
          'CommentPoll',
        );
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}