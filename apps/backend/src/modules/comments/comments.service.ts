import { Injectable, NotFoundException } from '@nestjs/common';
import { Comment, CommentActionType, CommentStatus, LogCategory, Prisma } from '@prisma/client';

import { AppLogger } from '../../common/logger/app-logger.service';
import { Paginated, PaginationHelper } from '../../common/pagination/pagination.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { AiService, AiUnavailableError } from '../ai/ai.service';
import { CampaignExecutorService } from '../../workers/campaign-executor.service';
import { AuditService } from '../audit/audit.service';
import { CommentFilterDto } from './dto/comment-filter.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { ModerateCommentDto } from './dto/moderate-comment.dto';

export type CommentDetail = Comment & {
  post: { id: string; content: string; metaPermalinkUrl: string | null };
  page: { id: string; name: string };
  replies: Comment[];
};

/**
 * Sincronización y moderación de comentarios.
 * - La sincronización trae comentarios reales de la Graph API (solo lectura).
 * - reply / moderate ejecutan acciones directas en Meta y registran audit + CommentAction.
 * - autoReply genera (IA) y envía la respuesta de forma síncrona vía executor.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly facebook: FacebookService,
    private readonly ai: AiService,
    private readonly executor: CampaignExecutorService,
    private readonly pagination: PaginationHelper,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // Consulta
  // ---------------------------------------------------------------------------

  async findAll(userId: string, query: CommentFilterDto): Promise<Paginated<CommentDetail>> {
    const opts = this.pagination.parsePageOptions(query as unknown as Record<string, unknown> | undefined);
    const where: Prisma.CommentWhereInput = {
      page: { userId },
      ...(query.postId ? { postId: query.postId } : {}),
      ...(query.pageId ? { pageId: query.pageId } : {}),
      ...(query.riskLevel ? { riskLevel: query.riskLevel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.needsModeration === 'true'
        ? { status: CommentStatus.VISIBLE, riskLevel: { in: ['MEDIUM', 'HIGH'] } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: {
          post: { select: { id: true, content: true, metaPermalinkUrl: true } },
          page: { select: { id: true, name: true } },
          replies: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      this.prisma.comment.count({ where }),
    ]);
    return this.pagination.buildPaginated(rows, total, opts);
  }

  async findOne(userId: string, id: string): Promise<CommentDetail> {
    const comment = await this.prisma.comment.findFirst({
      where: { id, page: { userId } },
      include: {
        post: { select: { id: true, content: true, metaPermalinkUrl: true } },
        page: { select: { id: true, name: true } },
        replies: true,
      },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    return comment;
  }

  // ---------------------------------------------------------------------------
  // Sincronización desde la Graph API (solo lectura)
  // ---------------------------------------------------------------------------

  async syncFromFacebook(userId: string, postId: string): Promise<{ synced: number; skipped: number }> {
    const post = await this.prisma.post.findFirst({ where: { id: postId, userId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    if (!post.metaObjectId) {
      throw new NotFoundException('La publicación aún no ha sido publicada en Meta (sin metaObjectId)');
    }

    let synced = 0;
    let skipped = 0;
    let after: string | undefined;

    do {
      const page = await this.facebook.getPostComments(post.metaObjectId, post.pageId, { limit: 100, after });
      for (const meta of page.data ?? []) {
        const data = {
          pageId: post.pageId,
          metaCommentId: meta.id,
          fromUserId: meta.from?.id ?? null,
          fromName: meta.from?.name ?? null,
          parentId: meta.parent?.id ? await this.findOrCreateParentId(meta.parent.id, meta.id, post) : null,
          message: meta.message ?? '',
          isHidden: meta.is_hidden ?? false,
          status:
            meta.is_hidden === true ? CommentStatus.HIDDEN : CommentStatus.VISIBLE,
        };

        const existing = await this.prisma.comment.findUnique({ where: { metaCommentId: meta.id } });
        if (existing) {
          if (existing.status === CommentStatus.RESPONDED) skipped += 1;
          else {
            await this.prisma.comment.update({ where: { id: existing.id }, data });
          }
          continue;
        }
        await this.prisma.comment.create({ data: { postId, ...data } });
        synced += 1;
      }
      after = page.paging?.cursors?.after;
    } while (after);

    await this.audit.record({
      action: 'comment.sync',
      category: LogCategory.COMMENT,
      userId,
      pageId: post.pageId,
      postId,
      metadata: { synced, skipped },
    });
    this.logger.log(`Sincronización de comentarios: ${synced} nuevos, ${skipped} ya respondidos (post ${postId})`);
    return { synced, skipped };
  }

  // ---------------------------------------------------------------------------
  // Acciones sobre Meta
  // ---------------------------------------------------------------------------

  async reply(userId: string, id: string, dto: ReplyCommentDto): Promise<CommentDetail> {
    const comment = await this.requireComment(userId, id);
    const result = await this.facebook.replyToComment(comment.metaCommentId, comment.pageId, dto.message);

    await this.prisma.commentAction.create({
      data: {
        commentId: id,
        type: CommentActionType.REPLY,
        payload: { message: dto.message, tone: dto.tone },
        metaActionResult: result,
        performedByUserId: userId,
      },
    });
    const updated = await this.prisma.comment.update({
      where: { id },
      data: { status: CommentStatus.RESPONDED },
      include: {
        post: { select: { id: true, content: true, metaPermalinkUrl: true } },
        page: { select: { id: true, name: true } },
        replies: true,
      },
    });
    await this.audit.record({
      action: 'comment.reply',
      category: LogCategory.COMMENT,
      userId,
      pageId: comment.pageId,
      postId: comment.postId,
      metadata: { commentId: id },
    });
    return updated;
  }

  /** Genera (IA) y envía la respuesta al comentario de forma síncrona. */
  async autoReply(userId: string, id: string, tone: string | undefined): Promise<{ actionId: string; viaIa: boolean }> {
    const comment = await this.requireComment(userId, id);
    if (!this.ai.isEnabled) {
      throw new AiUnavailableError('IA no configurada: no se puede responder automáticamente');
    }
    const result = await this.executor.executeCommentReply(id, comment.pageId, { tone });
    await this.audit.record({
      action: 'comment.autoreply',
      category: LogCategory.COMMENT,
      userId,
      pageId: comment.pageId,
      postId: comment.postId,
      metadata: { commentId: id, tone, viaIa: result.viaIa, actionId: result.actionId },
    });
    return { actionId: result.actionId, viaIa: result.viaIa };
  }

  async moderate(userId: string, id: string, dto: ModerateCommentDto): Promise<CommentDetail> {
    const comment = await this.requireComment(userId, id);

    if (dto.action === 'hide') {
      await this.facebook.setCommentHidden(comment.metaCommentId, comment.pageId, true);
      await this.recordAction(id, userId, CommentActionType.HIDE, {});
    } else if (dto.action === 'unhide') {
      await this.facebook.setCommentHidden(comment.metaCommentId, comment.pageId, false);
      await this.recordAction(id, userId, CommentActionType.UNHIDE, {});
    } else {
      await this.facebook.deleteComment(comment.metaCommentId, comment.pageId);
      await this.recordAction(id, userId, CommentActionType.DELETE, {});
    }

    const data =
      dto.action === 'hide'
        ? { status: CommentStatus.HIDDEN, isHidden: true }
        : dto.action === 'unhide'
          ? { status: CommentStatus.VISIBLE, isHidden: false }
          : { status: CommentStatus.DELETED };

    const updated = await this.prisma.comment.update({
      where: { id },
      data,
      include: {
        post: { select: { id: true, content: true, metaPermalinkUrl: true } },
        page: { select: { id: true, name: true } },
        replies: true,
      },
    });
    await this.audit.record({
      action: `comment.${dto.action}`,
      category: LogCategory.COMMENT,
      userId,
      pageId: comment.pageId,
      postId: comment.postId,
      metadata: { commentId: id },
    });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Ingesta vía webhook de Meta
  // ---------------------------------------------------------------------------

  /**
   * Crea (o devuelve si ya existe) un comentario entrante desde el webhook.
   * Idempotente por metaCommentId; el webhook solo notifica, la sincronización
   * completa queda a cargo de `syncFromFacebook`.
   */
  async handleIncomingComment(input: {
    metaCommentId: string;
    pageId: string;
    postId: string;
    parentId?: string | null;
    fromUserId?: string;
    fromName?: string;
    message: string;
    isHidden?: boolean;
    createdAt?: Date;
  }): Promise<Comment | null> {
    if (!input.metaCommentId) return null;
    const existing = await this.prisma.comment.findUnique({ where: { metaCommentId: input.metaCommentId } });
    if (existing) return existing;
    return this.prisma.comment.create({
      data: {
        pageId: input.pageId,
        postId: input.postId,
        metaCommentId: input.metaCommentId,
        parentId: input.parentId ?? null,
        fromUserId: input.fromUserId ?? null,
        fromName: input.fromName ?? null,
        message: input.message,
        isHidden: input.isHidden ?? false,
        isFromPage: false,
        status: input.isHidden ? CommentStatus.HIDDEN : CommentStatus.VISIBLE,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async requireComment(userId: string, id: string): Promise<Comment> {
    const comment = await this.prisma.comment.findFirst({
      where: { id, page: { userId } },
      include: { post: { select: { id: true, userId: true } } },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    return comment;
  }

  private async findOrCreateParentId(metaParentId: string, childMetaCommentId: string, post: {
    id: string;
    pageId: string;
  }): Promise<string | null> {
    const parent = await this.prisma.comment.findUnique({ where: { metaCommentId: metaParentId } });
    if (parent) return parent.id;
    const created = await this.prisma.comment.create({
      data: {
        postId: post.id,
        pageId: post.pageId,
        metaCommentId: metaParentId,
        message: '',
        isFromPage: true,
      },
    });
    void childMetaCommentId;
    return created.id;
  }

  private async recordAction(
    commentId: string,
    performedByUserId: string,
    type: CommentActionType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.commentAction.create({
      data: { commentId, type, payload: payload as Prisma.InputJsonValue, performedByUserId },
    });
  }
}