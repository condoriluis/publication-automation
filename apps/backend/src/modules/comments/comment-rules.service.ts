import { Injectable, NotFoundException } from '@nestjs/common';
import { CommentRule, Prisma } from '@prisma/client';

import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentRuleDto, UpdateCommentRuleDto } from './dto/comment-rule.dto';

@Injectable()
export class CommentRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  private async requirePageOwner(userId: string, pageId: string): Promise<void> {
    const page = await this.prisma.page.findFirst({ where: { id: pageId, userId }, select: { id: true } });
    if (!page) throw new NotFoundException('Página no encontrada');
  }

  private async requireRule(userId: string, id: string): Promise<CommentRule> {
    const rule = await this.prisma.commentRule.findFirst({
      where: { id, page: { userId } },
    });
    if (!rule) throw new NotFoundException('Regla no encontrada');
    return rule;
  }

  async list(userId: string, pageId: string): Promise<CommentRule[]> {
    await this.requirePageOwner(userId, pageId);
    return this.prisma.commentRule.findMany({
      where: { pageId },
      orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateCommentRuleDto): Promise<CommentRule> {
    await this.requirePageOwner(userId, dto.pageId);
    const rule = await this.prisma.commentRule.create({
      data: {
        pageId: dto.pageId,
        name: dto.name,
        enabled: dto.enabled ?? true,
        keywords: dto.keywords && dto.keywords.length > 0 ? (dto.keywords as Prisma.InputJsonValue) : Prisma.JsonNull,
        classifications: dto.classifications && dto.classifications.length > 0
          ? (dto.classifications as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        maxConfidence: dto.maxConfidence ?? null,
        action: dto.action,
        replyTemplate: dto.action === 'REPLY' ? (dto.replyTemplate ?? null) : null,
      },
    });
    this.logger.log(`Regla de comentarios "${dto.name}" creada (${dto.pageId})`, 'CommentRules');
    return rule;
  }

  async update(userId: string, id: string, dto: UpdateCommentRuleDto): Promise<CommentRule> {
    const rule = await this.requireRule(userId, id);
    const data: Prisma.CommentRuleUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.keywords !== undefined) {
      data.keywords = dto.keywords.length > 0 ? (dto.keywords as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if (dto.classifications !== undefined) {
      data.classifications = dto.classifications.length > 0
        ? (dto.classifications as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (dto.maxConfidence !== undefined) data.maxConfidence = dto.maxConfidence;
    if (dto.action !== undefined) {
      if (rule.action === 'REPLY' && dto.action !== 'REPLY') data.replyTemplate = null;
      data.action = dto.action;
    }
    if (dto.replyTemplate !== undefined) data.replyTemplate = dto.replyTemplate;

    const updated = await this.prisma.commentRule.update({ where: { id }, data });
    this.logger.log(`Regla de comentarios ${id} actualizada`, 'CommentRules');
    return updated;
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const rule = await this.requireRule(userId, id);
    await this.prisma.commentRule.delete({ where: { id: rule.id } });
    this.logger.log(`Regla de comentarios ${id} eliminada`, 'CommentRules');
    return { deleted: true };
  }
}