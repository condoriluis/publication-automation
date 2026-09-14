import { Injectable } from '@nestjs/common';
import { AuditLog, LogCategory, Prisma } from '@prisma/client';
import { Paginated, PaginationHelper, PaginationOptions } from '../../common/pagination/pagination.helper';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditRecordInput {
  userId?: string;
  pageId?: string;
  campaignId?: string;
  postId?: string;
  action: string;
  category?: LogCategory;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface AuditFilters {
  action?: string;
  userId?: string;
  pageId?: string;
  campaignId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helper: PaginationHelper,
  ) {}

  async record(input: AuditRecordInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        pageId: input.pageId,
        campaignId: input.campaignId,
        postId: input.postId,
        action: input.action,
        category: input.category ?? LogCategory.SYSTEM,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: input.ip,
        userAgent: input.userAgent,
      },
    });
  }

  async findAll(
    filters: AuditFilters,
    options: PaginationOptions,
  ): Promise<Paginated<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.action) where.action = filters.action;
    if (filters.userId) where.userId = filters.userId;
    if (filters.pageId) where.pageId = filters.pageId;
    if (filters.campaignId) where.campaignId = filters.campaignId;
    if (filters.from || filters.to) {
      where.createdAt = {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.skip,
        take: options.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return this.helper.buildPaginated(rows, total, options);
  }
}