import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { LogCategory, PostStatus } from '@prisma/client';

import { AppLogger } from '../common/logger/app-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../modules/audit/audit.service';
import { FacebookService } from '../modules/facebook/facebook.service';

const ONE_HOUR_MS = 3_600_000;
const DISTRIBUTION_GRACE_HOURS = 6;

/**
 * Sondea periódicamente los posts publicados y consulta su distribución real
 * en Meta (is_published, is_eligible_for_promotion y métricas de alcance).
 *
 * Dos objetivos:
 *  1) Rellenar EngagementMetric con métricas reales de la página (alcance,
 *     impresiones, engagement, likes, comentarios y compartidos).
 *  2) Detectar restricciones SILENCIOSAS de distribución de Meta (spam/calidad)
 *     y registrarlas para alertar al usuario (post.restricted).
 *
 * Corre via @Interval en todos los procesos (API y worker); cada post solo se
 * vuelve a consultar pasado un período de gracia, así que los duplicados entre
 * procesos son acotados y el ajuste es idempotente (upsert por postId).
 */
@Injectable()
export class PostInsightsService {
  private static readonly INTERVAL_MS = 10 * 60_000;
  private static readonly DEFAULT_WINDOW_HOURS = 24 * 7;
  private static readonly DEFAULT_REFRESH_AFTER_MS = 60 * 60_000;
  private static readonly DEFAULT_BATCH = 20;

  private readonly windowMs: number;
  private readonly refreshAfterMs: number;
  private readonly batch: number;
  /** Evita ticks solapados (mismo patrón que el resto de workers). */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebook: FacebookService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.windowMs = toInt(this.config.get<string>('POST_INSIGHTS_WINDOW_HOURS') ?? '', PostInsightsService.DEFAULT_WINDOW_HOURS) * ONE_HOUR_MS;
    this.refreshAfterMs = toInt(this.config.get<string>('POST_INSIGHTS_REFRESH_AFTER_MS') ?? '', PostInsightsService.DEFAULT_REFRESH_AFTER_MS);
    this.batch = toInt(this.config.get<string>('POST_INSIGHTS_BATCH') ?? '', PostInsightsService.DEFAULT_BATCH);
  }

  @Interval('post-insights', PostInsightsService.INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.error(
        `Tick de insights/distribución falló: ${(err as Error).message}`,
        undefined,
        'PostInsights',
      );
    } finally {
      this.running = false;
    }
  }

  private async runOnce(): Promise<void> {
    const now = Date.now();
    const refreshBefore = new Date(now - this.refreshAfterMs);

    const candidates = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        metaObjectId: { not: null },
        publishedAt: { gte: new Date(now - this.windowMs) },
        OR: [
          { engagement: null },
          { engagement: { measuredAt: { lt: refreshBefore } } },
        ],
      },
      orderBy: { publishedAt: 'asc' },
      take: this.batch,
      select: { id: true, pageId: true, metaObjectId: true, publishedAt: true },
    });

    for (const post of candidates) {
      await this.checkPost(post.id, post.pageId, post.metaObjectId as string, post.publishedAt ?? new Date(now), now);
    }
  }

  /** Refresca al instante las métricas de distribución de un post publicado. */
  async refreshPost(postId: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, pageId: true, metaObjectId: true, publishedAt: true, status: true },
    });
    if (!post || post.status !== PostStatus.PUBLISHED || !post.metaObjectId) return;
    await this.checkPost(post.id, post.pageId, post.metaObjectId, post.publishedAt ?? new Date(), Date.now());
  }

  private async checkPost(
    postId: string,
    pageId: string,
    metaObjectId: string,
    publishedAt: Date,
    now: number,
  ): Promise<void> {
    const dist = await this.facebook.getPostDistribution(pageId, metaObjectId);
    if (!dist) return; // Meta no pudo responder: mantener lo anterior.

    const ageHours = Math.max(0, (now - publishedAt.getTime()) / ONE_HOUR_MS);
    const { restricted, restrictionReason } = this.resolveRestriction(dist, ageHours);

    const previous = await this.prisma.engagementMetric.findUnique({
      where: { postId },
      select: { restricted: true },
    });

    await this.prisma.engagementMetric.upsert({
      where: { postId },
      create: {
        postId,
        likes: dist.likes,
        comments: dist.comments,
        shares: dist.shares,
        reach: dist.reach ?? 0,
        impressions: dist.impressions ?? 0,
        engagements: dist.engagements ?? 0,
        eligibleForPromotion: dist.eligibleForPromotion,
        restricted,
        restrictionReason,
        measuredAt: new Date(now),
      },
      update: {
        likes: dist.likes,
        comments: dist.comments,
        shares: dist.shares,
        reach: dist.reach ?? 0,
        impressions: dist.impressions ?? 0,
        engagements: dist.engagements ?? 0,
        eligibleForPromotion: dist.eligibleForPromotion,
        restricted,
        restrictionReason,
        measuredAt: new Date(now),
      },
    });

    if (restricted && !previous?.restricted) {
      await this.audit.record({
        action: 'post.distribution_restricted',
        category: LogCategory.POST,
        pageId,
        postId,
        metadata: { restrictionReason, reach: dist.reach ?? null },
      });
      this.logger.warn(`Meta limita la distribución del post ${postId}: ${restrictionReason}`, undefined, 'PostInsights');
    } else if (!restricted && previous?.restricted) {
      await this.audit.record({
        action: 'post.distribution_restored',
        category: LogCategory.POST,
        pageId,
        postId,
        metadata: { restrictionReason: null },
      });
    }
  }

  /**
   * Decide si Meta está restringiendo la distribución del post:
   *  - deja de reportarlo publicado (is_published=false),
   *  - lo marca no elegible para promoción (calidad/spam),
   *  - sin alcance tras el período de gracia (publicado pero oculto del feed).
   */
  private resolveRestriction(
    dist: { isPublished: boolean; eligibleForPromotion: boolean; reach: number | null },
    ageHours: number,
  ): { restricted: boolean; restrictionReason: string | null } {
    if (!dist.isPublished) {
      return {
        restricted: true,
        restrictionReason: 'Meta dejó de reportar la publicación como publicada (is_published=false).',
      };
    }
    if (!dist.eligibleForPromotion) {
      return {
        restricted: true,
        restrictionReason: 'Meta marcó el post como no elegible para promoción: distribución limitada por calidad de contenido.',
      };
    }
    if (dist.reach !== null && dist.reach === 0 && ageHours >= DISTRIBUTION_GRACE_HOURS) {
      return {
        restricted: true,
        restrictionReason: `Sin alcance tras ${DISTRIBUTION_GRACE_HOURS} h: Meta está limitando silenciosamente la distribución.`,
      };
    }
    return { restricted: false, restrictionReason: null };
  }
}

function toInt(value: string, fallback: number): number {
  const parsed = value === '' ? NaN : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}