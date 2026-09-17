import { Injectable } from '@nestjs/common';
import {
  CampaignStatus,
  CommentActionType,
  CommentStatus,
  GroupStatus,
  LogCategory,
  PostStatus,
} from '@prisma/client';

import { AppLogger } from '../common/logger/app-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { recordSentReply } from '../modules/comments/comment-reply.helper';
import { FacebookService, FacebookGraphError } from '../modules/facebook/facebook.service';
import { AiService } from '../modules/ai/ai.service';
import { AuditService } from '../modules/audit/audit.service';

export type PublishResult =
  | { status: 'published'; metaObjectId: string; metaPermalinkUrl: string }
  | { status: 'already-published' }
  | { status: 'skipped' }
  | { status: 'failed-permanent'; message: string };

/**
 * Núcleo de ejecución de acciones sobre Meta, compartido por la API y por el
 * worker sin cola externa. Todas las mutaciones son idempotentes por estado
 * en base de datos.
 */
@Injectable()
export class CampaignExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facebook: FacebookService,
    private readonly ai: AiService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // Publicación de un post (post suelto o post de campaña)
  // ---------------------------------------------------------------------------

  async publishPostToFacebook(postId: string, pageId: string): Promise<PublishResult> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) return { status: 'skipped' };
    if (post.status === PostStatus.PUBLISHED) return { status: 'already-published' };
    if (([PostStatus.FAILED, PostStatus.CANCELLED] as PostStatus[]).includes(post.status)) return { status: 'skipped' };
    if (post.pageId !== pageId) return { status: 'skipped' };

    await this.prisma.post.update({ where: { id: postId }, data: { status: PostStatus.PUBLISHING } });

    let metaObjectId: string;
    let metaPermalinkUrl: string;
    try {
      const result = await this.facebook.publishToPage(pageId, {
        message: post.content,
        imageUrls: (post.imageUrls as string[] | null) ?? undefined,
        videoUrl: post.videoUrl ?? undefined,
        linkUrl: post.linkUrl ?? undefined,
      });
      metaObjectId = result.id;
      metaPermalinkUrl = result.permalink;
    } catch (err) {
      if (err instanceof FacebookGraphError && err.isPermanent) {
        const message = err.message;
        await this.prisma.post.update({ where: { id: postId }, data: { status: PostStatus.FAILED } });
        await this.audit.record({
          action: 'post.publish_failed',
          category: LogCategory.POST,
          pageId,
          postId,
          campaignId: post.campaignId ?? undefined,
          metadata: { message },
        });
        this.logger.error(`Post ${postId} falló de forma permanente: ${message}`);
        if (post.campaignId) {
          await this.prisma.campaign.update({
            where: { id: post.campaignId },
            data: { actionsFailed: { increment: 1 } },
          });
        }
        return { status: 'failed-permanent', message };
      }
      throw err;
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.PUBLISHED, publishedAt: new Date(), metaObjectId, metaPermalinkUrl },
    });
    await this.audit.record({
      action: 'post.published',
      category: LogCategory.POST,
      pageId,
      postId,
      campaignId: post.campaignId ?? undefined,
      metadata: { metaObjectId },
    });
    if (post.campaignId) {
      await this.prisma.campaign.update({
        where: { id: post.campaignId },
        data: { actionsDone: { increment: 1 } },
      });
    }
    this.logger.log(`Post ${postId} publicado`);
    return { status: 'published', metaObjectId, metaPermalinkUrl };
  }

  // ---------------------------------------------------------------------------
  // Respuesta automática a un comentario (manual o IA, síncrona)
  // ---------------------------------------------------------------------------

  async executeCommentReply(
    commentId: string,
    pageId: string,
    config: { message?: string; tone?: string } = {},
  ): Promise<{ actionId: string; viaIa: boolean }> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new Error('comment-not-found');
    if (comment.status === CommentStatus.RESPONDED) return { actionId: commentId, viaIa: false };
    if (comment.pageId !== pageId) throw new Error('page-mismatch');

    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    const finalMessage =
      config.message ??
      (await this.ai.generateReply({
        pageName: page?.name,
        postText: undefined,
        commentMessage: comment.message,
        tone: config.tone,
      }));
    const viaIa = !config.message;

    const result = await this.facebook.replyToComment(comment.metaCommentId, comment.pageId, finalMessage);

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { status: CommentStatus.RESPONDED },
    });
    await recordSentReply(this.prisma, {
      metaCommentId: result.id,
      parentId: comment.id,
      pageId: comment.pageId,
      postId: comment.postId,
      pageName: page?.name ?? 'Página',
      message: finalMessage,
    });
    const action = await this.prisma.commentAction.create({
      data: {
        commentId,
        type: viaIa ? CommentActionType.AI_REPLY : CommentActionType.REPLY,
        payload: { message: finalMessage, tone: config.tone },
        metaActionResult: result,
      },
    });
    await this.audit.record({
      action: 'comment.autoreply',
      category: LogCategory.COMMENT,
      pageId: comment.pageId,
      postId: comment.postId,
      metadata: { commentId, viaIa },
    });
    this.logger.log(`Respuesta ${viaIa ? 'IA' : 'manual'} enviada al comentario ${commentId}`);
    return { actionId: action.id, viaIa };
  }

  // ---------------------------------------------------------------------------
  // Activación y materialización de grupos
  // ---------------------------------------------------------------------------

  /** Crea (upsert) los CampaignGroup a partir del JSON `groups` de la campaña. */
  async materializeGroups(campaignId: string): Promise<
    Array<{ id: string; position: number; actionsTarget: number; intervalSeconds: number; waitAfterSeconds: number }>
  > {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    const raw =
      (campaign.groups as Array<{ percentage: number; intervalSeconds: number; waitAfterSeconds?: number }> | null) ??
      [];
    const groups: Array<{
      id: string;
      position: number;
      actionsTarget: number;
      intervalSeconds: number;
      waitAfterSeconds: number;
    }> = [];

    for (let position = 0; position < raw.length; position++) {
      const cfg = raw[position];
      const actionsTarget = Math.round((campaign.totalActions * cfg.percentage) / 100);
      const group = await this.prisma.campaignGroup.upsert({
        where: { campaignId_position: { campaignId, position } },
        create: {
          campaignId,
          position,
          name: `Grupo ${position + 1}`,
          percentage: cfg.percentage,
          intervalSeconds: cfg.intervalSeconds,
          waitAfterSeconds: cfg.waitAfterSeconds ?? campaign.groupsWaitSeconds,
          actionsTarget,
        },
        update: {
          percentage: cfg.percentage,
          intervalSeconds: cfg.intervalSeconds,
          waitAfterSeconds: cfg.waitAfterSeconds ?? campaign.groupsWaitSeconds,
          actionsTarget,
        },
      });
      groups.push({
        id: group.id,
        position: group.position,
        actionsTarget: group.actionsTarget,
        intervalSeconds: group.intervalSeconds,
        waitAfterSeconds: group.waitAfterSeconds,
      });
    }
    return groups.sort((a, b) => a.position - b.position);
  }

  /** Activa el primer grupo pendiente: quedará tomado por el worker próximamente. */
  async activateCampaignGroups(campaignId: string): Promise<void> {
    await this.materializeGroups(campaignId);
    const first = await this.prisma.campaignGroup.findFirst({
      where: { campaignId, status: { not: GroupStatus.COMPLETED } },
      orderBy: { position: 'asc' },
    });
    if (!first) return; // todos completados: no hay nada que arrancar
    await this.prisma.campaignGroup.update({
      where: { id: first.id },
      data: { status: GroupStatus.PENDING, nextRunAt: new Date(), leaseExpiresAt: null },
    });
  }

  // ---------------------------------------------------------------------------
  // Finalización
  // ---------------------------------------------------------------------------

  /** Cierra la campaña y cancela posts pendientes (fin por totalActions o endsAt). */
  async finalizeCampaign(campaignId: string): Promise<boolean> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return false;
    if (!([CampaignStatus.RUNNING, CampaignStatus.SCHEDULED] as CampaignStatus[]).includes(campaign.status)) return false;

    await this.prisma.post.updateMany({
      where: { campaignId, status: { in: [PostStatus.SCHEDULED, PostStatus.PUBLISHING, PostStatus.DRAFT] } },
      data: { status: PostStatus.CANCELLED },
    });
    await this.prisma.campaignGroup.updateMany({
      where: { campaignId },
      data: { status: GroupStatus.COMPLETED, finishedAt: new Date(), leaseExpiresAt: null },
    });
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
    });
    await this.audit.record({ action: 'campaign.completed', category: LogCategory.CAMPAIGN, campaignId });
    this.logger.log(`Campaña ${campaignId} completada`);
    return true;
  }

  /** Marca la campaña como FAILED si aún no se publicó nada con éxito. */
  async markCampaignFailure(campaignId: string, message: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== CampaignStatus.RUNNING) return;
    if (campaign.actionsDone > 0) return;

    await this.prisma.post.updateMany({
      where: { campaignId, status: { in: [PostStatus.SCHEDULED, PostStatus.PUBLISHING] } },
      data: { status: PostStatus.CANCELLED },
    });
    await this.prisma.campaignGroup.updateMany({
      where: { campaignId },
      data: { status: GroupStatus.COMPLETED, finishedAt: new Date(), leaseExpiresAt: null },
    });
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.FAILED, errorMessage: message },
    });
    await this.audit.record({
      action: 'campaign.failed',
      category: LogCategory.CAMPAIGN,
      campaignId,
      metadata: { message },
    });
    this.logger.warn(`Campaña ${campaignId} marcada FAILED: ${message}`);
  }
}