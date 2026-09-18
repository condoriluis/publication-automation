import { Injectable } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationHelper, Paginated } from '../../common/pagination/pagination.helper';

export class SummaryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class EngagementQueryDto {
  @IsOptional()
  @IsString()
  pageId?: string;

  @IsOptional()
  @IsIn(['7d', '30d'])
  range?: '7d' | '30d' = '7d';
}

export interface RecentActivityItem {
  id: string;
  action: string;
  category: string;
  pageId: string | null;
  campaignId: string | null;
  postId: string | null;
  ipAddress: string | null;
  createdAt: Date;
  user: { displayName: string; email: string } | null;
}

export interface DashboardSummary {
  totals: {
    postsPublicados: number;
    programados: number;
    fallidos: number;
    campañasActivas: number;
    paginasConectadas: number;
    comentariosRecientes: number;
    respuestasPendientes: number;
  };
  actividadReciente: Paginated<RecentActivityItem>;
}

export interface EngagementSeriesDay {
  date: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  engagements: number;
  followers: number | null;
  totalInteractions: number | null;
  reached: number | null;
  engagedUsers: number | null;
}

export interface EngagementSeries {
  pageId: string | null;
  range: '7d' | '30d';
  from: string;
  to: string;
  dias: EngagementSeriesDay[];
}

interface EngagementRow {
  day: Date | string;
  likes: number | string | null;
  comments: number | string | null;
  shares: number | string | null;
  reach: number | string | null;
  impressions: number | string | null;
  engagements: number | string | null;
}

interface PageMetricRow {
  day: Date | string;
  followers: number | string | null;
  totalInteractions: number | string | null;
  reached: number | string | null;
  impressions: number | string | null;
  engagedUsers: number | string | null;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationHelper,
  ) {}

  async getSummary(userId: string, query: SummaryQueryDto): Promise<DashboardSummary> {
    const { page, limit, skip, sortOrder } = this.pagination.parsePageOptions(query as unknown as Record<string, unknown>);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userScope = { userId };

    const [postsPublicados, programados, fallidos, campañasActivas, paginasConectadas, comentariosRecientes, respuestasPendientes] =
      await Promise.all([
        this.prisma.post.count({ where: { ...userScope, status: 'PUBLISHED' } }),
        this.prisma.post.count({ where: { ...userScope, status: 'SCHEDULED' } }),
        this.prisma.post.count({ where: { ...userScope, status: 'FAILED' } }),
        this.prisma.campaign.count({ where: { ...userScope, status: { in: ['RUNNING', 'SCHEDULED'] } } }),
        this.prisma.page.count({ where: { ...userScope, status: 'ACTIVE' } }),
        this.prisma.comment.count({ where: { createdAt: { gte: since24h }, page: { userId } } }),
        this.prisma.comment.count({ where: { status: 'VISIBLE', isFromPage: false, page: { userId } } }),
      ]);

    const userAudit = { userId };

    const [activity, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: userAudit,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          category: true,
          pageId: true,
          campaignId: true,
          postId: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { displayName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where: userAudit }),
    ]);

    return {
      totals: {
        postsPublicados,
        programados,
        fallidos,
        campañasActivas,
        paginasConectadas,
        comentariosRecientes,
        respuestasPendientes,
      },
      actividadReciente: this.pagination.buildPaginated(activity, total, { page, limit, skip, take: limit, sortBy: 'createdAt', sortOrder }),
    };
  }

  async getEngagementSeries(userId: string, query: EngagementQueryDto): Promise<EngagementSeries> {
    const range = query.range ?? '7d';
    const days = range === '30d' ? 30 : 7;
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);

    const pageIdClause = query.pageId ? Prisma.sql`AND p."pageId" = ${query.pageId}` : Prisma.empty;
    const metricPageIdClause = query.pageId ? Prisma.sql`AND pm."pageId" = ${query.pageId}` : Prisma.empty;

    const engagementRows = await this.prisma.$queryRaw<EngagementRow[]>`
      SELECT DATE(e."measuredAt") AS day,
             COALESCE(SUM(e.likes), 0) AS likes,
             COALESCE(SUM(e.comments), 0) AS comments,
             COALESCE(SUM(e.shares), 0) AS shares,
             COALESCE(SUM(e.reach), 0) AS reach,
             COALESCE(SUM(e.impressions), 0) AS impressions,
             COALESCE(SUM(e.engagements), 0) AS engagements
      FROM "EngagementMetric" e
      INNER JOIN "Post" p ON p.id = e."postId"
      WHERE e."measuredAt" >= ${from}
        AND e."measuredAt" <= ${to}
        AND p."userId" = ${userId}
        ${pageIdClause}
      GROUP BY DATE(e."measuredAt")
      ORDER BY DATE(e."measuredAt") ASC
    `;

    const pageMetricRows = await this.prisma.$queryRaw<PageMetricRow[]>`
      SELECT DATE(pm."measuredAt") AS day,
             MAX(pm."followersCount") AS followers,
             MAX(pm."totalInteractions") AS totalInteractions,
             MAX(pm."reachedCount") AS reached,
             MAX(pm."impressionsCount") AS impressions,
             MAX(pm."engagedUsersCount") AS engagedUsers
      FROM "PageMetric" pm
      WHERE pm."measuredAt" >= ${from}
        AND pm."measuredAt" <= ${to}
        AND pm."pageId" IN (SELECT p2."id" FROM "Page" p2 WHERE p2."userId" = ${userId})
        ${metricPageIdClause}
      GROUP BY DATE(pm."measuredAt")
      ORDER BY DATE(pm."measuredAt") ASC
    `;

    const byDay = new Map<string, EngagementSeriesDay>();
    for (const row of engagementRows) {
      const key = this.dayKey(row.day);
      byDay.set(key, {
        date: key,
        likes: this.toNumber(row.likes),
        comments: this.toNumber(row.comments),
        shares: this.toNumber(row.shares),
        reach: this.toNumber(row.reach),
        impressions: this.toNumber(row.impressions),
        engagements: this.toNumber(row.engagements),
        followers: null,
        totalInteractions: null,
        reached: null,
        engagedUsers: null,
      });
    }
    for (const row of pageMetricRows) {
      const key = this.dayKey(row.day);
      const current = byDay.get(key) ?? this.emptyDay(key);
      current.followers = this.toNumber(row.followers);
      current.totalInteractions = this.toNumber(row.totalInteractions);
      current.reached = this.toNumber(row.reached);
      current.impressions = this.toNumber(row.impressions);
      current.engagedUsers = this.toNumber(row.engagedUsers);
      byDay.set(key, current);
    }

    const dias: EngagementSeriesDay[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const key = this.dayKey(cursor);
      dias.push(byDay.get(key) ?? this.emptyDay(key));
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      pageId: query.pageId ?? null,
      range,
      from: this.dayKey(from),
      to: this.dayKey(to),
      dias,
    };
  }

  private emptyDay(key: string): EngagementSeriesDay {
    return {
      date: key,
      likes: 0,
      comments: 0,
      shares: 0,
      reach: 0,
      impressions: 0,
      engagements: 0,
      followers: null,
      totalInteractions: null,
      reached: null,
      engagedUsers: null,
    };
  }

  private toNumber(value: number | string | null): number {
    return Number(value ?? 0);
  }

  private dayKey(value: Date | string): string {
    if (typeof value === 'string') return value.slice(0, 10);
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }
}