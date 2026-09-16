import { Injectable } from '@nestjs/common';
import { CommentActionType, CommentClassification, CommentRuleAction, CommentStatus, LogCategory, Prisma } from '@prisma/client';

import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { FacebookService, FacebookGraphError } from '../facebook/facebook.service';
import { AuditService } from '../audit/audit.service';

const DEFAULT_SETTINGS = {
  autoReplyEnabled: true,
  aiEnabled: true,
  maxAutoRepliesPerPost: 10,
  minResponseDelaySeconds: 30,
  maxResponseDelaySeconds: 120,
  replyTemplate: '',
} as const;

@Injectable()
export class CommentAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly facebook: FacebookService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // Punto de entrada principal
  // ---------------------------------------------------------------------------

  /**
   * Procesa un comentario: clasifica con IA (si aplica), evalúa reglas y
   * ejecuta la primera coincidente.
   * Ejecución asíncrona — puede fallar sin afectar al webhook.
   * Idempotente: si el comentario ya tiene una acción registrada, no repite.
   */
  async processNewComment(commentId: string, opts: { reanalyze?: boolean } = {}): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: { select: { id: true, content: true, metaObjectId: true } },
      },
    });
    if (!comment || comment.isFromPage || comment.status !== CommentStatus.VISIBLE) return;

    // Idempotencia: un comentario con alguna acción ya fue atendido (add+edited,
    // re-entregas del webhook o reanálisis) y no debe generar acciones duplicadas.
    const priorAction = await this.prisma.commentAction.findFirst({ where: { commentId } });
    if (priorAction) return;

    const settings = await this.loadSettings(comment.pageId);
    if (settings.aiEnabled === false) return;

    // --- 1. Clasificar con IA si aún no está analizado (o se pide reanálisis) ---
    if ((!comment.analyzedAt || opts.reanalyze === true) && this.ai.isEnabled) {
      try {
        await this.ai.analyzeComments([commentId]);
      } catch (err) {
        this.logger.warn(`Auto-clasificación fallida para ${commentId}: ${(err as Error).message}`, 'CommentAutomation');
      }
    }

    // Recargar después de posibles actualizaciones
    const updated = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!updated) return;

    // --- 2. Buscar primera regla que aplique ---
    const rules = await this.prisma.commentRule.findMany({
      where: { pageId: comment.pageId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const rule of rules) {
      if (this.matchesRule(updated, rule)) {
        await this.executeRule(commentId, updated, rule, settings);
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Matching
  // ---------------------------------------------------------------------------

  private matchesRule(comment: { message: string; classification: CommentClassification | null; confidence: number | null }, rule: {
    keywords: unknown;
    classifications: unknown;
    maxConfidence: number | null;
  }): boolean {
    // keywords: todos los substrings deben aparecer (case-insensitive)
    const keywords = rule.keywords as string[] | null;
    if (keywords && keywords.length > 0) {
      const msg = comment.message.toLowerCase();
      if (!keywords.every(k => msg.includes(k.toLowerCase()))) return false;
    }

    // classifications: comentario debe estar en la lista (si la lista tiene valores)
    const classifs = rule.classifications as CommentClassification[] | null;
    if (classifs && classifs.length > 0) {
      if (!comment.classification || !classifs.includes(comment.classification)) return false;
    }

    // maxConfidence: confianza del comentario debe ser <= este valor
    if (rule.maxConfidence !== null && rule.maxConfidence !== undefined) {
      if (comment.confidence === null || comment.confidence > rule.maxConfidence) return false;
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Ejecución de reglas
  // ---------------------------------------------------------------------------

  private async executeRule(
    commentId: string,
    comment: { id: string; postId: string; pageId: string; metaCommentId: string; fromName: string | null; status: CommentStatus; message: string },
    rule: { id: string; action: CommentRuleAction; replyTemplate: string | null; name: string },
    settings: Record<string, unknown>,
  ): Promise<void> {
    switch (rule.action) {
      case 'REPLY':
        return this.executeReply(comment, rule, settings);
      case 'HIDE':
        return this.executeHide(comment);
      case 'DELETE':
        return this.executeDelete(comment);
      case 'FLAG_REVIEW':
        return this.executeFlagReview(commentId, comment);
    }
  }

  // --- REPLY ---------------------------------------------------------------

  private async executeReply(
    comment: { id: string; postId: string; pageId: string; metaCommentId: string; fromName: string | null; status: CommentStatus; message: string },
    rule: { id: string; name: string; replyTemplate: string | null },
    settings: Record<string, unknown>,
  ): Promise<void> {
    if (settings.autoReplyEnabled === false) return;

    // Verificar máximo de auto-respuestas por post
    const maxPerPost = typeof settings.maxAutoRepliesPerPost === 'number' ? settings.maxAutoRepliesPerPost : DEFAULT_SETTINGS.maxAutoRepliesPerPost;
    if (maxPerPost > 0) {
      const count = await this.prisma.commentAction.count({
        where: {
          comment: { postId: comment.postId },
          type: { in: [CommentActionType.REPLY, CommentActionType.AI_REPLY] },
          status: 'SUCCESS',
        },
      });
      if (count >= maxPerPost) return;
    }

    // Preparar respuesta
    let replyMessage: string | null = null;

    if (rule.replyTemplate) {
      replyMessage = rule.replyTemplate.replace(/\{nombre\}/gi, comment.fromName ?? 'amigo');
    } else if (this.ai.isEnabled) {
      const post = await this.prisma.post.findUnique({ where: { id: comment.postId }, select: { id: true, content: true, metaPermalinkUrl: true } });
      const page = await this.prisma.page.findUnique({ where: { id: comment.pageId }, select: { id: true, name: true, category: true, description: true } });
      if (post && page) {
        try {
          replyMessage = await this.ai.generateReply({
            pageName: page.name,
            postText: post.content,
            commentMessage: comment.message,
          });
        } catch (err) {
          this.logger.warn(`Fallo IA al generar respuesta para ${comment.id}: ${(err as Error).message}`, 'CommentAutomation');
        }
      }
    }

    if (!replyMessage) return;

    // Calcular delay
    const minDelay = typeof settings.minResponseDelaySeconds === 'number' ? settings.minResponseDelaySeconds : DEFAULT_SETTINGS.minResponseDelaySeconds;
    const maxDelay = typeof settings.maxResponseDelaySeconds === 'number' ? settings.maxResponseDelaySeconds : DEFAULT_SETTINGS.maxResponseDelaySeconds;
    const delaySeconds = this.randomDelay(minDelay, maxDelay);
    const executeAt = new Date(Date.now() + delaySeconds * 1000);

    // Registrar como PENDING con executeAt para que el worker lo publique
    await this.prisma.commentAction.create({
      data: {
        commentId: comment.id,
        type: CommentActionType.AI_REPLY,
        payload: { message: replyMessage, ruleId: rule.id, ruleName: rule.name } as Prisma.InputJsonValue,
        status: 'PENDING',
        executeAt,
      },
    });
    await this.audit.record({
      action: 'comment.automation.reply_scheduled',
      category: LogCategory.COMMENT,
      pageId: comment.pageId,
      postId: comment.postId,
      metadata: { commentId: comment.id, ruleId: rule.id, executeAt: executeAt.toISOString() },
    });
    this.logger.debug(`Auto-respuesta programada para ${comment.id} a las ${executeAt.toISOString()}`, 'CommentAutomation');
  }

  // --- HIDE ----------------------------------------------------------------

  private async executeHide(
    comment: { id: string; metaCommentId: string; pageId: string; postId: string },
  ): Promise<void> {
    try {
      await this.facebook.setCommentHidden(comment.metaCommentId, comment.pageId, true);
      await this.prisma.comment.update({
        where: { id: comment.id },
        data: { status: CommentStatus.HIDDEN, isHidden: true },
      });
      await this.prisma.commentAction.create({
        data: {
          commentId: comment.id,
          type: CommentActionType.HIDE,
          payload: { automated: true },
          metaActionResult: { hidden: true },
          status: 'SUCCESS',
        },
      });
      await this.audit.record({
        action: 'comment.automation.hide',
        category: LogCategory.COMMENT,
        pageId: comment.pageId,
        postId: comment.postId,
        metadata: { commentId: comment.id },
      });
      this.logger.debug(`Comentario ${comment.id} ocultado automáticamente`, 'CommentAutomation');
    } catch (err) {
      const isPermission = err instanceof FacebookGraphError && ((err as { status?: number }).status === 403 || (err as { status?: number }).status === 400);
      this.logger.warn(`Fallo al ocultar ${comment.id}${isPermission ? ' (permisos)' : ''}: ${(err as Error).message}`, 'CommentAutomation');
      await this.prisma.commentAction.create({
        data: {
          commentId: comment.id,
          type: CommentActionType.HIDE,
          payload: { automated: true },
          status: 'FAILURE',
          errorMessage: (err as Error).message,
        },
      });
    }
  }

  // --- DELETE --------------------------------------------------------------

  private async executeDelete(
    comment: { id: string; metaCommentId: string; pageId: string; postId: string },
  ): Promise<void> {
    try {
      await this.facebook.deleteComment(comment.metaCommentId, comment.pageId);
      await this.prisma.comment.update({
        where: { id: comment.id },
        data: { status: CommentStatus.DELETED },
      });
      await this.prisma.commentAction.create({
        data: {
          commentId: comment.id,
          type: CommentActionType.DELETE,
          payload: { automated: true },
          metaActionResult: { deleted: true },
          status: 'SUCCESS',
        },
      });
      await this.audit.record({
        action: 'comment.automation.delete',
        category: LogCategory.COMMENT,
        pageId: comment.pageId,
        postId: comment.postId,
        metadata: { commentId: comment.id },
      });
      this.logger.debug(`Comentario ${comment.id} eliminado automáticamente`, 'CommentAutomation');
    } catch (err) {
      this.logger.warn(`Fallo al eliminar ${comment.id}: ${(err as Error).message}`, 'CommentAutomation');
      await this.prisma.commentAction.create({
        data: {
          commentId: comment.id,
          type: CommentActionType.DELETE,
          payload: { automated: true },
          status: 'FAILURE',
          errorMessage: (err as Error).message,
        },
      });
    }
  }

  // --- FLAG_REVIEW ---------------------------------------------------------

  private async executeFlagReview(
    commentId: string,
    comment: { pageId: string; postId: string },
  ): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { needsReview: true },
    });
    await this.prisma.commentAction.create({
      data: {
        commentId,
        type: CommentActionType.MANUAL,
        payload: { reason: 'flag_review_automation' },
        status: 'SUCCESS',
      },
    });
    await this.audit.record({
      action: 'comment.automation.flag_review',
      category: LogCategory.COMMENT,
      pageId: comment.pageId,
      postId: comment.postId,
      metadata: { commentId },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async loadSettings(pageId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: `page:settings:${pageId}` } });
    return ((row?.value as Record<string, unknown>) ?? {});
  }

  private randomDelay(minSec: number, maxSec: number): number {
    const min = Math.max(0, Math.floor(minSec));
    const max = Math.max(min, Math.floor(maxSec));
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}