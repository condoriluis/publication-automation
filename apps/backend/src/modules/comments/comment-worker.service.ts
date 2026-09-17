import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CommentActionType, CommentStatus, LogCategory, Prisma } from '@prisma/client';

import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { recordSentReply } from './comment-reply.helper';
import { FacebookService } from '../facebook/facebook.service';
import { AuditService } from '../audit/audit.service';
import { CommentAutomationService } from './comment-automation.service';

const POLL_INTERVAL_MS = 10_000;
const LEASE_MS = 60_000;
/** Antigüedad mínima para reinspeccionar un comentario sin analizar. */
const RECOVERY_AGE_MS = 120_000;
/** Máximo de comentarios rescatados por ciclo (evita ráfagas de IA). */
const RECOVERY_BATCH = 5;

@Injectable()
export class CommentWorkerService {
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebook: FacebookService,
    private readonly audit: AuditService,
    private readonly automation: CommentAutomationService,
    private readonly logger: AppLogger,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processPendingActions();
      await this.recoverStaleComments();
    } finally {
      this.running = false;
    }
  }

  /**
   * Auto-recovery: comentarios visibles que quedaron sin analizar (webhook perdido,
   * IA caída al momento del add, sync manual omitido) se reinyectan en el pipeline
   * de clasificación + reglas. `processNewComment` es idempotente, así que un
   * comentario ya atendido no vuelve a generar acciones.
   */
  private async recoverStaleComments(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - RECOVERY_AGE_MS);
      const stale = await this.prisma.comment.findMany({
        where: {
          isFromPage: false,
          status: CommentStatus.VISIBLE,
          analyzedAt: null,
          createdAt: { lte: cutoff },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: RECOVERY_BATCH,
      });
      for (const comment of stale) {
        void this.automation.processNewComment(comment.id).catch(err => {
          this.logger.warn(`Auto-recovery de comentario ${comment.id} fallido: ${(err as Error).message}`, 'CommentWorker');
        });
      }
      if (stale.length > 0) {
        this.logger.debug(`Auto-recovery: ${stale.length} comentario(s) sin analizar reinyectados`, 'CommentWorker');
      }
    } catch (err) {
      this.logger.warn(`Auto-recovery de comentarios falló: ${(err as Error).message}`, 'CommentWorker');
    }
  }

  private async processPendingActions(): Promise<void> {
    // Buscar y reclamar de forma atómica la primera acción pendiente
    const now = new Date();
    const candidates = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "CommentAction"
      SET "leaseExpiresAt" = ${new Date(now.getTime() + LEASE_MS)}
      WHERE id = (
        SELECT id FROM "CommentAction"
        WHERE status = 'PENDING'
          AND "executeAt" <= ${now}
          AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < ${now})
        ORDER BY "executeAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `;

    if (candidates.length === 0) return;

    const actionId = candidates[0].id;
    const action = await this.prisma.commentAction.findUnique({
      where: { id: actionId },
      include: {
        comment: {
          include: {
            post: { select: { id: true, content: true, metaPermalinkUrl: true } },
            page: { select: { name: true } },
          },
        },
      },
    });

    if (!action || action.status !== 'PENDING') {
      await this.release(actionId);
      return;
    }

    // Si el comentario ya no está visible, cancelar
    if (action.comment.status !== CommentStatus.VISIBLE) {
      await this.markFailure(actionId, 'Comentario ya no está visible');
      return;
    }

    try {
      const type = action.type;
      if (type === CommentActionType.AI_REPLY || type === CommentActionType.REPLY) {
        await this.executeReplyAction(action);
      } else if (type === CommentActionType.HIDE) {
        await this.executeHideAction(action);
      } else if (type === CommentActionType.DELETE) {
        await this.executeDeleteAction(action);
      } else {
        await this.markSuccess(actionId, {});
      }
    } catch (err) {
      await this.markFailure(actionId, (err as Error).message);
    }
  }

  // ---------------------------------------------------------------------------
  // Ejecutores
  // ---------------------------------------------------------------------------

  private async executeReplyAction(action: {
    id: string;
    commentId: string;
    payload: unknown;
    comment: {
      id: string;
      metaCommentId: string;
      pageId: string;
      postId: string;
      fromName: string | null;
      post: { id: string; content: string };
      page: { name: string } | null;
    };
  }): Promise<void> {
    const payload = (action.payload ?? {}) as { message?: string };
    const message = payload.message;
    if (!message) throw new Error('Respuesta sin mensaje en payload');

    const result = await this.facebook.replyToComment(action.comment.metaCommentId, action.comment.pageId, message);

    await this.prisma.comment.update({
      where: { id: action.commentId },
      data: { status: CommentStatus.RESPONDED },
    });
    await recordSentReply(this.prisma, {
      metaCommentId: result.id,
      parentId: action.commentId,
      pageId: action.comment.pageId,
      postId: action.comment.postId,
      pageName: action.comment.page?.name ?? 'Página',
      message,
    });

    await this.markSuccess(action.id, result);

    await this.audit.record({
      action: 'comment.autoreply',
      category: LogCategory.COMMENT,
      pageId: action.comment.pageId,
      postId: action.comment.postId,
      metadata: { commentId: action.commentId, actionId: action.id, viaWorker: true },
    });
  }

  private async executeHideAction(action: {
    id: string;
    commentId: string;
    comment: { metaCommentId: string; pageId: string };
  }): Promise<void> {
    await this.facebook.setCommentHidden(action.comment.metaCommentId, action.comment.pageId, true);

    await this.prisma.comment.update({
      where: { id: action.commentId },
      data: { status: CommentStatus.HIDDEN, isHidden: true },
    });

    await this.markSuccess(action.id, { hidden: true });
  }

  private async executeDeleteAction(action: {
    id: string;
    commentId: string;
    comment: { metaCommentId: string; pageId: string };
  }): Promise<void> {
    await this.facebook.deleteComment(action.comment.metaCommentId, action.comment.pageId);

    await this.prisma.comment.update({
      where: { id: action.commentId },
      data: { status: CommentStatus.DELETED },
    });

    await this.markSuccess(action.id, { deleted: true });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async markSuccess(id: string, metaActionResult: unknown): Promise<void> {
    await this.prisma.commentAction.update({
      where: { id },
      data: {
        status: 'SUCCESS',
        leaseExpiresAt: null,
        metaActionResult: metaActionResult ? (metaActionResult as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  private async markFailure(id: string, message: string): Promise<void> {
    await this.prisma.commentAction.update({
      where: { id },
      data: {
        status: 'FAILURE',
        leaseExpiresAt: null,
        errorMessage: message,
      },
    });
    this.logger.warn(`Acción de comentario ${id} fallida: ${message}`, 'CommentWorker');
  }

  private async release(id: string): Promise<void> {
    await this.prisma.commentAction.update({
      where: { id },
      data: { leaseExpiresAt: null },
    });
  }
}