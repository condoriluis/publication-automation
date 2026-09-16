import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { AppConfigService as AppConfig } from '../../config/app-config.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { CommentsService } from '../comments/comments.service';
import { CommentAutomationService } from '../comments/comment-automation.service';

export interface IncomingWebhookComment {
  metaCommentId: string;
  pageId: string;
  postId: string;
  parentId?: string | null;
  fromUserId?: string | null;
  fromName?: string | null;
  message: string;
  isHidden: boolean;
  createdAt?: Date;
}

/**
 * Valor de un change de webhook de objeto `page`.
 *
 * Meta entrega los eventos de comentarios de dos formas:
 * - `field: "feed"` con `value.item === "comment"` → el id vive en `value.comment_id`.
 * - `field: "comments"` → el id vive en `value.id`.
 * El resto de `value.*` es común (post_id, parent_id, message, from, is_hidden, verb).
 */
interface MetaChangeValue {
  /** item del change `feed` (comment/status/photo/video/link/...). */
  item?: string;
  /** verb del evento (add/edited/remove/hide/unhide/spam/approve). */
  verb?: string;
  /** id del comentario en `field: "comments"`. */
  id?: string | number;
  /** id del comentario en `field: "feed"` con item=comment. */
  comment_id?: string | number;
  message?: unknown;
  is_hidden?: boolean;
  created_time?: number | string;
  post_id?: string | number;
  parent_id?: string | number;
  from?: Record<string, unknown>;
}

interface MetaChange {
  field: string;
  value: Record<string, unknown>;
}

interface MetaPostRef {
  id: string;
}

interface MetaEntry {
  id: string;
  time?: number;
  changes?: MetaChange[];
}

interface MetaWebhookPayload {
  object?: string;
  entry?: MetaEntry[];
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly appConfig: AppConfig,
    private readonly crypto: CryptoService,
    private readonly commentsService: CommentsService,
    private readonly commentAutomation: CommentAutomationService,
  ) {}

  verifySignature(rawBody: Buffer, signatureHeader: string): boolean {
    if (!signatureHeader) return false;
    const [scheme, digest] = signatureHeader.split('=');
    if (scheme !== 'sha256' || !digest) return false;
    const expected = this.crypto.hmac(rawBody.toString('utf8'), this.appConfig.facebookAppSecret);
    return this.crypto.safeEqual(expected, digest);
  }

  async processPayload(payload: unknown): Promise<void> {
    const parsed = (payload ?? {}) as MetaWebhookPayload;
    if (parsed.object !== 'page') {
      this.logger.debug(`Webhook de Meta ignorado: object="${parsed.object ?? '(vacío)'}"`, 'WebhooksService');
      return;
    }
    for (const entry of parsed.entry ?? []) {
      try {
        await this.processEntry(entry);
      } catch (error) {
        this.logger.warn(
          `Error procesando entrada del webhook de Meta: ${error instanceof Error ? error.message : String(error)}`,
          'WebhooksService',
        );
      }
    }
  }

  private async processEntry(entry: MetaEntry): Promise<void> {
    const page = await this.prisma.page.findFirst({
      where: { facebookPageId: entry.id },
      select: { id: true, name: true },
    });
    if (!page) {
      this.logger.warn(`Webhook de página no registrada: ${entry.id}`, 'WebhooksService');
      return;
    }
    for (const change of entry.changes ?? []) {
      const v = change.value as MetaChangeValue;
      if (change.field === 'feed') {
        // Solo los cambios de comentarios importan; el resto son publicaciones
        if (v.item === 'comment') {
          await this.processCommentEvent(change.value, page);
        } else {
          this.logger.debug(
            `Change de feed "${v.item ?? '(sin item)'}" sin acciones de comentario`,
            'WebhooksService',
          );
        }
      } else if (change.field === 'comments') {
        await this.processCommentEvent(change.value, page);
      } else {
        this.logger.debug(`Campo de webhook "${change.field}" confirmado sin acciones`, 'WebhooksService');
      }
    }
  }

  private async processCommentEvent(value: Record<string, unknown>, page: { id: string; name: string }): Promise<void> {
    const v = value as MetaChangeValue;
    const metaCommentId = (v.comment_id ?? v.id) !== undefined ? String(v.comment_id ?? v.id) : '';
    const verb = typeof v.verb === 'string' ? v.verb.toLowerCase() : '';
    const message = typeof v.message === 'string' ? v.message : '';

    if (!metaCommentId) {
      this.logger.warn('Comentario de webhook sin id; ignorado', 'WebhooksService');
      return;
    }

    // --- Eventos de moderación/borrado: operan sobre el registro ya existente ---
    if (verb === 'remove' || verb === 'deleted' || verb === 'hide' || verb === 'unhide' || verb === 'spam' || verb === 'approve') {
      const isDelete = verb === 'remove' || verb === 'deleted';
      const isHidden =
        verb === 'hide' || verb === 'spam' ? true : verb === 'unhide' || verb === 'approve' ? false : undefined;

      const existing = await this.commentsService.applyIncomingModeration(metaCommentId, {
        deleted: isDelete,
        hidden: isHidden,
      });
      if (existing) {
        this.logger.debug(`Comentario ${metaCommentId} → verb=${verb} (${existing.status})`, 'WebhooksService');
        return;
      }

      // El comentario nunca fue ingerido (p. ej. moderado antes del primer sync):
      // se crea un registro mínimo para que la bandeja de moderación refleje la realidad.
      const created = await this.ensureRecord(metaCommentId, value, page, { hidden: isDelete || isHidden === true });
      if (created) {
        await this.commentsService.applyIncomingModeration(metaCommentId, { deleted: isDelete, hidden: isHidden });
        this.logger.debug(
          `Comentario ${metaCommentId} creado retroactivamente por verb=${verb}`,
          'WebhooksService',
        );
      }
      return;
    }

    // --- add / edited: ingesta idempotente + actualización ---
    const metaPostId = v.post_id !== undefined ? String(v.post_id) : '';
    const from = (v.from ?? {}) as Record<string, unknown>;
    const fromUserId = from.id !== undefined ? String(from.id) : undefined;
    const fromName = typeof from.name === 'string' ? from.name : undefined;
    const createdAt = v.created_time !== undefined ? new Date(Number(v.created_time) * 1000) : undefined;

    if (verb === 'edited') {
      const updated = await this.commentsService.updateIncomingComment(metaCommentId, {
        message,
        fromUserId,
        fromName,
        createdAt,
      });
      if (!updated) {
        this.logger.debug(
          `Edit de comentario ${metaCommentId} sin registro previo; se trata como nuevo`,
          'WebhooksService',
        );
        const result = await this.createWithAutomation(metaCommentId, value, page, {
          fromUserId,
          fromName,
          createdAt,
        });
        if (result) this.triggerAutomation(result);
        return;
      }
      // Re-evalúa reglas solo si el comentario nunca recibió una acción (evita duplicados).
      const prior = await this.prisma.commentAction.count({ where: { commentId: updated.id } });
      if (prior === 0) {
        void this.commentAutomation.processNewComment(updated.id, { reanalyze: true }).catch(err => {
          this.logger.warn(`Re-evaluación de comentario ${updated.id} fallida: ${(err as Error).message}`, 'WebhooksService');
        });
      }
      return;
    }

    // verb=add (o desconocido): ingesta
    const result = await this.createWithAutomation(metaCommentId, value, page, { fromUserId, fromName, createdAt });
    if (result) this.triggerAutomation(result);
  }

  /**
   * Crea (idempotente) el comentario entrante resolviendo post/padre. Devuelve
   * el comentario solo cuando existe en la base o pudo ubicarse su publicación.
   */
  private async ensureRecord(
    metaCommentId: string,
    value: Record<string, unknown>,
    page: { id: string; name: string },
    opts: { hidden?: boolean },
  ): Promise<MetaPostRef | null> {
    const v = value as MetaChangeValue;
    const from = (v.from ?? {}) as Record<string, unknown>;
    const createdAt = v.created_time !== undefined ? new Date(Number(v.created_time) * 1000) : undefined;
    return this.createWithAutomation(metaCommentId, value, page, {
      fromUserId: from.id !== undefined ? String(from.id) : undefined,
      fromName: typeof from.name === 'string' ? from.name : undefined,
      createdAt,
      hidden: opts.hidden,
    });
  }

  private async createWithAutomation(
    metaCommentId: string,
    value: Record<string, unknown>,
    page: { id: string; name: string },
    opts: { fromUserId?: string; fromName?: string; createdAt?: Date; hidden?: boolean } = {},
  ): Promise<{ id: string; created: boolean } | null> {
    const v = value as MetaChangeValue;
    const metaPostId = v.post_id !== undefined ? String(v.post_id) : '';
    const post = await this.findPostForObject(metaPostId);
    if (!post) {
      this.logger.warn(
        `Comentario ${metaCommentId} sin publicación conocida (${metaPostId || 'sin post_id'}); descartado`,
        'WebhooksService',
      );
      return null;
    }

    let parentId: string | null = null;
    if (v.parent_id !== undefined) {
      const parent = await this.prisma.comment.findUnique({
        where: { metaCommentId: String(v.parent_id) },
        select: { id: true },
      });
      parentId = parent?.id ?? null;
    }

    const message = typeof v.message === 'string' ? v.message : '';
    const result = await this.commentsService.createIncomingComment({
      metaCommentId,
      pageId: page.id,
      postId: post.id,
      parentId,
      fromUserId: opts.fromUserId,
      fromName: opts.fromName,
      message,
      isHidden: opts.hidden ?? v.is_hidden === true,
      createdAt: opts.createdAt,
    });
    return result ? { id: result.comment.id, created: result.created } : null;
  }

  /** Localiza un post por metaObjectId; si el id es `page_post`, prueba el sufijo. */
  private async findPostForObject(metaPostId: string): Promise<MetaPostRef | null> {
    if (!metaPostId) return null;
    const exact = await this.prisma.post.findFirst({
      where: { metaObjectId: metaPostId },
      select: { id: true },
    });
    if (exact) return exact;

    const idx = metaPostId.lastIndexOf('_');
    if (idx >= 0 && idx < metaPostId.length - 1) {
      const suffix = metaPostId.slice(idx + 1);
      const bySuffix = await this.prisma.post.findFirst({
        where: { metaObjectId: suffix },
        select: { id: true },
      });
      if (bySuffix) return bySuffix;
    }
    return null;
  }

  private triggerAutomation(result: { id: string; created: boolean }): void {
    // Comentario nuevo (no duplicado): disparar clasificación + reglas
    if (result.created) {
      void this.commentAutomation.processNewComment(result.id).catch(err => {
        this.logger.warn(`Automatización de comentario ${result.id} fallida: ${(err as Error).message}`, 'WebhooksService');
      });
    }
  }
}