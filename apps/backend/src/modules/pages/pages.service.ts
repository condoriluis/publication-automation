import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Page, Prisma } from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PaginationHelper, Paginated } from '../../common/pagination/pagination.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { FacebookService, MetaPageSummary } from '../facebook/facebook.service';
import { QueryPagesDto } from './dto/query-pages.dto';
import { SyncPagesDto } from './dto/sync-pages.dto';
import { UpdatePageSettingsDto } from './dto/update-page-settings.dto';

export interface PageListRow {
  id: string;
  name: string;
  facebookPageId: string;
  category: string | null;
  pictureUrl: string | null;
  followersCount: number;
  status: string;
  updatedAt: Date;
  account: { id: string; facebookUserName: string | null; status: string } | null;
}

export interface MetricSeriesPoint {
  date: string;
  followersCount: number;
  totalPosts: number;
  totalInteractions: number;
  reachedCount: number;
  impressionsCount: number;
  engagedUsersCount: number;
}

interface MetricBucket {
  date: string;
  count: number;
  followersCount: number;
  totalPosts: number;
  totalInteractions: number;
  reachedCount: number;
  impressionsCount: number;
  engagedUsersCount: number;
}

/** Key de AppSetting donde viven los ajustes operativos de una página. */
const pageSettingsKey = (pageId: string): string => `page:settings:${pageId}`;

/**
 * Gestión de páginas de Facebook: listado, detalle, ajustes, métricas y
 * sincronización con la API de Meta.
 */
@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly facebook: FacebookService,
    private readonly pagination: PaginationHelper,
    private readonly logger: AppLogger,
    private readonly config: AppConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Sincronización con Meta
  // ---------------------------------------------------------------------------

  /**
   * Sincroniza todas las páginas de una cuenta: llama facebook.getPages
   * y hace upsert de cada Page por (accountId, facebookPageId).
   */
  async syncPages(accountId: string): Promise<{ synced: number; accountId: string; userId: string }> {
    const account = await this.prisma.facebookAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Cuenta de Facebook no encontrada');

    const token = this.decryptToken(account.accessTokenEncrypted);
    const metaPages = await this.facebook.getPages(token);
    const synced = await this.upsertPages(account.id, account.userId, metaPages);

    this.logger.log(`Sincronizadas ${synced} páginas de la cuenta ${accountId}`, 'Pages');
    return { synced, accountId: account.id, userId: account.userId };
  }

  /** Sincroniza todas las páginas de una cuenta verificando que es del usuario. */
  async syncAccount(userId: string, accountId: string): Promise<{ synced: number; accountId: string }> {
    const account = await this.prisma.facebookAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Cuenta de Facebook no encontrada');

    const res = await this.syncPages(account.id);
    return { synced: res.synced, accountId: res.accountId };
  }

  /** Sincroniza una página concreta (POST /pages/:id/sync). */
  async syncPage(userId: string, pageId: string, _dto?: SyncPagesDto): Promise<Page & { settings: Record<string, unknown> }> {
    const page = await this.prisma.page.findFirst({ where: { id: pageId, userId } });
    if (!page) throw new NotFoundException('Página no encontrada');

    const account = await this.prisma.facebookAccount.findUnique({ where: { id: page.accountId } });
    if (!account) throw new BadGatewayException('La cuenta de Facebook asociada no está disponible');

    const token = this.decryptToken(account.accessTokenEncrypted);
    const metaPages = await this.facebook.getPages(token);
    const meta = metaPages.find((p) => p.id === page.facebookPageId);

    if (!meta) {
      throw new NotFoundException('La página ya no está vinculada a esta cuenta de Meta');
    }

    const pageTokenEncrypted = meta.access_token ? this.encryptToken(meta.access_token) : undefined;
    const updated = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        name: meta.name,
        category: meta.category ?? page.category,
        pictureUrl: this.pictureUrl(meta.picture) ?? page.pictureUrl,
        url: meta.link ?? page.url,
        followersCount: meta.fan_count ?? page.followersCount,
        status: meta.is_published === false ? 'DISABLED' : 'ACTIVE',
        ...(pageTokenEncrypted ? { accessTokenEncrypted: pageTokenEncrypted } : {}),
      },
      include: {
        account: { select: { id: true, facebookUserName: true, status: true } },
      },
    });

    return { ...updated, settings: await this.getSettings(pageId) };
  }

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------

  /** Listado paginado de páginas del usuario con filtros. */
  async findAll(userId: string, query: QueryPagesDto): Promise<Paginated<PageListRow>> {
    const opts = this.pagination.parsePageOptions(query as Record<string, unknown> | undefined);

    const where: Prisma.PageWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: { contains: query.category } } : {}),
      ...(query.search ? { name: { contains: query.search } } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.page.findMany({
        where,
        select: {
          id: true,
          name: true,
          facebookPageId: true,
          category: true,
          pictureUrl: true,
          followersCount: true,
          status: true,
          updatedAt: true,
          account: { select: { id: true, facebookUserName: true, status: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      this.prisma.page.count({ where }),
    ]);

    return this.pagination.buildPaginated(data as PageListRow[], total, opts);
  }

  /** Detalle de una página con su cuenta de Facebook y ajustes operativos. */
  async findOne(
    userId: string,
    pageId: string,
  ): Promise<Page & { settings: Record<string, unknown> }> {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, userId },
      include: {
        account: { select: { id: true, facebookUserId: true, facebookUserName: true, status: true } },
      },
    });
    if (!page) throw new NotFoundException('Página no encontrada');

    return { ...page, settings: await this.getSettings(pageId) };
  }

  // ---------------------------------------------------------------------------
  // Ajustes
  // ---------------------------------------------------------------------------

  /**
   * Actualiza los ajustes operativos de la página. Persistimos en AppSetting
   * como JSON (key `page:settings:{pageId}`) porque el modelo Page no expone
   * columnas dedicadas para autoReply/IA/modereación.
   */
  async updateSettings(
    userId: string,
    pageId: string,
    data: UpdatePageSettingsDto,
  ): Promise<{ pageId: string; settings: Record<string, unknown> }> {
    const page = await this.prisma.page.findFirst({ where: { id: pageId, userId }, select: { id: true } });
    if (!page) throw new NotFoundException('Página no encontrada');

    const key = pageSettingsKey(pageId);
    const existing = await this.prisma.appSetting.findUnique({ where: { key } });
    const merged = { ...(((existing?.value as Record<string, unknown>) ?? {})), ...data };

    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: merged },
      update: { value: merged },
    });

    this.logger.log(`Ajustes actualizados para la página ${pageId}`, 'Pages');
    return { pageId, settings: merged };
  }

  private async getSettings(pageId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: pageSettingsKey(pageId) } });
    return ((row?.value as Record<string, unknown>) ?? {});
  }

  // ---------------------------------------------------------------------------
  // Métricas
  // ---------------------------------------------------------------------------

  /**
   * Agrega PageMetric en el rango [from, to]: devuelve el total y una serie
   * diaria por día. Los contadores tipo snapshot (followers/totalPosts) se
   * promedian por día; las interacciones/alcance/impresiones se suman.
   */
  async getMetrics(
    userId: string,
    pageId: string,
    from: Date,
    to: Date,
  ): Promise<{
    pageId: string;
    from: string;
    to: string;
    totals: Record<string, number>;
    samples: number;
    series: MetricSeriesPoint[];
  }> {
    const page = await this.prisma.page.findFirst({ where: { id: pageId, userId }, select: { id: true } });
    if (!page) throw new NotFoundException('Página no encontrada');

    const rows = await this.prisma.pageMetric.findMany({
      where: { pageId, measuredAt: { gte: from, lte: to } },
      orderBy: { measuredAt: 'asc' },
      select: {
        measuredAt: true,
        followersCount: true,
        totalPosts: true,
        totalInteractions: true,
        reachedCount: true,
        impressionsCount: true,
        engagedUsersCount: true,
      },
    });

    const totals = {
      totalInteractions: 0,
      reachedCount: 0,
      impressionsCount: 0,
      engagedUsersCount: 0,
    };
    const buckets = new Map<string, MetricBucket>();

    for (const row of rows) {
      const date = row.measuredAt.toISOString().slice(0, 10);
      const bucket = buckets.get(date) ?? {
        date,
        count: 0,
        followersCount: 0,
        totalPosts: 0,
        totalInteractions: 0,
        reachedCount: 0,
        impressionsCount: 0,
        engagedUsersCount: 0,
      };
      bucket.count += 1;
      bucket.followersCount += row.followersCount;
      bucket.totalPosts += row.totalPosts;
      bucket.totalInteractions += row.totalInteractions;
      bucket.reachedCount += row.reachedCount;
      bucket.impressionsCount += row.impressionsCount;
      bucket.engagedUsersCount += row.engagedUsersCount;
      buckets.set(date, bucket);

      totals.totalInteractions += row.totalInteractions;
      totals.reachedCount += row.reachedCount;
      totals.impressionsCount += row.impressionsCount;
      totals.engagedUsersCount += row.engagedUsersCount;
    }

    const series: MetricSeriesPoint[] = [];
    for (const b of buckets.values()) {
      series.push({
        date: b.date,
        followersCount: Math.round(b.followersCount / b.count),
        totalPosts: Math.round(b.totalPosts / b.count),
        totalInteractions: b.totalInteractions,
        reachedCount: b.reachedCount,
        impressionsCount: b.impressionsCount,
        engagedUsersCount: b.engagedUsersCount,
      });
    }

    return {
      pageId,
      from: from.toISOString(),
      to: to.toISOString(),
      totals,
      samples: rows.length,
      series,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async upsertPages(
    accountId: string,
    userId: string,
    metaPages: MetaPageSummary[],
  ): Promise<number> {
    for (const meta of metaPages) {
      const pageTokenEncrypted = meta.access_token ? this.encryptToken(meta.access_token) : undefined;
      await this.prisma.page.upsert({
        where: { accountId_facebookPageId: { accountId, facebookPageId: meta.id } },
        create: {
          accountId,
          userId,
          facebookPageId: meta.id,
          name: meta.name,
          category: meta.category ?? null,
          pictureUrl: this.pictureUrl(meta.picture),
          url: meta.link ?? null,
          followersCount: meta.fan_count ?? 0,
          accessTokenEncrypted: pageTokenEncrypted ?? '',
        },
        update: {
          name: meta.name,
          category: meta.category ?? null,
          pictureUrl: this.pictureUrl(meta.picture),
          url: meta.link ?? null,
          followersCount: meta.fan_count ?? 0,
          status: meta.is_published === false ? 'DISABLED' : 'ACTIVE',
          ...(pageTokenEncrypted ? { accessTokenEncrypted: pageTokenEncrypted } : {}),
        },
      });
    }
    return metaPages.length;
  }

  private pictureUrl(picture?: { url?: string; data?: { url?: string } }): string | undefined {
    return picture?.url ?? picture?.data?.url ?? undefined;
  }

  private encryptToken(token: string): string {
    return this.crypto.encrypt(token, { hexKey: this.config.tokenEncryptionKey });
  }

  private decryptToken(payload: string): string {
    return this.crypto.decrypt(payload, { hexKey: this.config.tokenEncryptionKey });
  }
}