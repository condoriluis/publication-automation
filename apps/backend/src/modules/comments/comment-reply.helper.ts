import { CommentStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

export interface SentReplyInput {
  /** Id del comentario creado en Facebook al responder. */
  metaCommentId: string;
  /** Id interno del comentario al que se responde. */
  parentId: string;
  pageId: string;
  postId: string;
  pageName: string;
  message: string;
}

/**
 * Materializa la respuesta enviada a Facebook como comentario de la página
 * (isFromPage=true) anidado al comentario respondido. Idempotente por
 * metaCommentId: si la ingesta por webhook/sync ya lo registró, se reutiliza,
 * evitando duplicados en la tabla.
 */
export async function recordSentReply(prisma: PrismaService, input: SentReplyInput): Promise<void> {
  if (!input.metaCommentId) return;
  const existing = await prisma.comment.findUnique({
    where: { metaCommentId: input.metaCommentId },
    select: { id: true },
  });
  if (existing) return;
  await prisma.comment.create({
    data: {
      pageId: input.pageId,
      postId: input.postId,
      metaCommentId: input.metaCommentId,
      parentId: input.parentId,
      fromUserId: null,
      fromName: input.pageName,
      message: input.message,
      isHidden: false,
      isFromPage: true,
      status: CommentStatus.VISIBLE,
    },
  });
}