import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LogCategory, Prisma, Post, PostStatus } from '@prisma/client';

import { AppLogger } from '../../common/logger/app-logger.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { Paginated, PaginationHelper } from '../../common/pagination/pagination.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignExecutorService } from '../../workers/campaign-executor.service';
import { AuditService } from '../audit/audit.service';
import { FacebookService } from '../facebook/facebook.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostFilterDto } from './dto/post-filter.dto';

export type PostDetail = Post & {
  page: { id: string; name: string };
  campaign: { id: string; name: string } | null;
  engagement: { likes: number; comments: number; shares: number; reach: number; impressions: number } | null;
  _count: { comments: number };
};

/**
 * Publicaciones programadas/publicadas de las páginas.
 * La publicación real (Graph API) se ejecuta de forma síncrona vía
 * CampaignExecutorService (sin cola externa; idempotente por estado).
 */
@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly pagination: PaginationHelper,
    private readonly executor: CampaignExecutorService,
    private readonly facebook: FacebookService,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
  ) {}

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    await this.assertOwnedPage(userId, dto.pageId);

    const campaignId = dto.campaignId
      ? await this.assertOwnedCampaign(userId, dto.campaignId, dto.pageId)
      : undefined;

    const scheduledFor = dto.scheduledFor ? new Date(dto.scheduledFor) : null;
    const status: PostStatus =
      scheduledFor && scheduledFor.getTime() > Date.now() ? PostStatus.SCHEDULED : PostStatus.DRAFT;

    const post = await this.prisma.post.create({
      data: {
        userId,
        pageId: dto.pageId,
        campaignId,
        content: dto.content,
        imageUrls: dto.imageUrls ?? [],
        videoUrl: dto.videoUrl,
        scheduledFor,
        status,
        aiGenerated: dto.aiGenerated ?? false,
        aiProvider: dto.aiGenerated ? 'ai' : null,
        dedupeKey: this.buildDedupeKey(dto.pageId, dto.content),
      },
    });

    await this.audit.record({
      action: 'post.create',
      category: LogCategory.POST,
      userId,
      pageId: dto.pageId,
      campaignId,
      postId: post.id,
      metadata: { status },
    });
    this.logger.log(`Post ${post.id} creado (${status})`);
    return post;
  }

  async findAll(userId: string, query: PostFilterDto): Promise<Paginated<PostDetail>> {
    const opts = this.pagination.parsePageOptions(query as unknown as Record<string, unknown> | undefined);
    const where: Prisma.PostWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.pageId ? { pageId: query.pageId } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(query.search ? { content: { contains: query.search } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          page: { select: { id: true, name: true } },
          campaign: { select: { id: true, name: true } },
          engagement: true,
          _count: { select: { comments: true } },
        },
        orderBy: { statusChangedAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      this.prisma.post.count({ where }),
    ]);
    return this.pagination.buildPaginated(rows, total, opts);
  }

  async findOne(userId: string, id: string): Promise<PostDetail> {
    const post = await this.prisma.post.findFirst({
      where: { id, userId },
      include: {
        page: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
        engagement: true,
        _count: { select: { comments: true } },
      },
    });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    return post;
  }

  async update(userId: string, id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.requirePost(userId, id);
    if (post.status !== PostStatus.DRAFT) {
      throw new ConflictException('Solo se puede editar una publicación en DRAFT');
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        content: dto.content,
        imageUrls: dto.imageUrls,
        videoUrl: dto.videoUrl,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
        ...(dto.content ? { dedupeKey: this.buildDedupeKey(post.pageId, dto.content) } : {}),
      },
    });
    await this.audit.record({ action: 'post.update', category: LogCategory.POST, userId, postId: id });
    return updated;
  }

  async publish(userId: string, id: string): Promise<Post> {
    const post = await this.requirePost(userId, id);
    if (!([PostStatus.DRAFT, PostStatus.SCHEDULED, PostStatus.FAILED] as PostStatus[]).includes(post.status)) {
      throw new ConflictException(`No se puede publicar un post en estado ${post.status}`);
    }

    await this.prisma.post.update({
      where: { id },
      data: { status: PostStatus.PUBLISHING },
    });
    const result = await this.executor.publishPostToFacebook(id, post.pageId);
    const updated = await this.prisma.post.findUniqueOrThrow({ where: { id } });
    await this.audit.record({
      action: 'post.publish',
      category: LogCategory.POST,
      userId,
      pageId: post.pageId,
      postId: id,
      metadata: { result: result.status },
    });
    this.logger.log(`Post ${id} publicado (${result.status})`);
    return updated;
  }

  async cancel(userId: string, id: string): Promise<Post> {
    const post = await this.requirePost(userId, id);
    if (!([PostStatus.DRAFT, PostStatus.SCHEDULED, PostStatus.PUBLISHING] as PostStatus[]).includes(post.status)) {
      throw new ConflictException(`No se puede cancelar un post en estado ${post.status}`);
    }
    const updated = await this.prisma.post.update({
      where: { id },
      data: { status: PostStatus.CANCELLED },
    });
    await this.audit.record({ action: 'post.cancel', category: LogCategory.POST, userId, postId: id });
    return updated;
  }

  async remove(userId: string, id: string): Promise<{ success: boolean }> {
    const post = await this.requirePost(userId, id);
    if (post.status === PostStatus.PUBLISHING || post.status === PostStatus.PARTIALLY_FAILED) {
      throw new ConflictException('No se puede eliminar una publicación en proceso');
    }

    // Si llegó a Facebook, primero se elimina en Meta; luego se borra el registro.
    const publishedOnFacebook = post.status === PostStatus.PUBLISHED && Boolean(post.metaObjectId);
    if (publishedOnFacebook) {
      const page = await this.prisma.page.findFirst({ where: { id: post.pageId, userId } });
      if (!page) throw new NotFoundException('Página no encontrada');
      await this.facebook.deletePost(page.id, post.metaObjectId as string);
    }

    await this.prisma.post.delete({ where: { id } });
    await this.audit.record({
      action: 'post.delete',
      category: LogCategory.POST,
      userId,
      pageId: post.pageId,
      campaignId: post.campaignId ?? undefined,
      postId: id,
      metadata: { removedFromFacebook: publishedOnFacebook },
    });
    this.logger.log(`Post ${id} eliminado${publishedOnFacebook ? ' de Facebook y de la BD' : ' de la BD'}`);
    return { success: true };
  }

  private async requirePost(userId: string, id: string): Promise<Post> {
    const post = await this.prisma.post.findFirst({ where: { id, userId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    return post;
  }

  private async assertOwnedPage(userId: string, pageId: string): Promise<void> {
    const page = await this.prisma.page.findFirst({ where: { id: pageId, userId } });
    if (!page) throw new NotFoundException('Página no encontrada o no pertenece al usuario');
  }

  private async assertOwnedCampaign(userId: string, campaignId: string, pageId: string): Promise<string> {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign || campaign.pageId !== pageId) {
      throw new NotFoundException('Campaña no encontrada o no coincide con la página indicada');
    }
    return campaignId;
  }

  private buildDedupeKey(pageId: string, content: string): string {
    return this.crypto.hmac(`${pageId}:${content.trim()}`, 'post-dedupe');
  }
}