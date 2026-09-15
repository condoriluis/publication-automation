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

interface MetaChangeValue {
  id?: string | number;
  verb?: string;
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
      if (change.field === 'comment') {
        await this.processCommentChange(change.value, page);
      } else {
        this.logger.debug(`Campo de webhook "${change.field}" confirmado sin acciones`, 'WebhooksService');
      }
    }
  }

  private async processCommentChange(value: Record<string, unknown>, page: { id: string; name: string }): Promise<void> {
    const v = value as MetaChangeValue;
    const metaCommentId = v.id !== undefined ? String(v.id) : '';
    const verb = typeof v.verb === 'string' ? v.verb : '';
    const message = typeof v.message === 'string' ? v.message : '';

    if (!metaCommentId) {
      this.logger.warn('Comentario de webhook sin id; ignorado', 'WebhooksService');
      return;
    }
    if (verb === 'remove') {
      this.logger.debug(`Comentario ${metaCommentId} eliminado en origen; sin acciones`, 'WebhooksService');
      return;
    }

    const metaPostId = v.post_id !== undefined ? String(v.post_id) : '';
    const post = metaPostId
      ? await this.prisma.post.findFirst({ where: { metaObjectId: metaPostId }, select: { id: true } })
      : null;
    if (!post) {
      this.logger.warn(
        `Comentario ${metaCommentId} sin publicación conocida (${metaPostId || 'sin post_id'}); descartado`,
        'WebhooksService',
      );
      return;
    }

    let parentId: string | null = null;
    if (v.parent_id !== undefined) {
      const parent = await this.prisma.comment.findUnique({
        where: { metaCommentId: String(v.parent_id) },
        select: { id: true },
      });
      parentId = parent?.id ?? null;
    }

    const from = (v.from ?? {}) as Record<string, unknown>;
    const fromUserId = from.id !== undefined ? String(from.id) : undefined;
    const fromName = typeof from.name === 'string' ? from.name : undefined;
    const createdAt = v.created_time !== undefined ? new Date(Number(v.created_time) * 1000) : undefined;

    const result = await this.commentsService.handleIncomingComment({
      metaCommentId,
      pageId: page.id,
      postId: post.id,
      parentId,
      fromUserId,
      fromName,
      message,
      isHidden: v.is_hidden === true,
      createdAt,
    });

    // Comentario nuevo (no duplicado): disparar automatización (clasificación + reglas)
    if (result?.created) {
      const commentId = result.comment.id;
      void this.commentAutomation.processNewComment(commentId).catch(err => {
        this.logger.warn(`Automatización de comentario ${commentId} fallida: ${(err as Error).message}`, 'WebhooksService');
      });
    }
  }
}