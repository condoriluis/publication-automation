import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Campaign, CampaignGroup, CampaignStatus, GroupStatus, LogCategory, PostStatus, Prisma } from '@prisma/client';

import { AppLogger } from '../../common/logger/app-logger.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { Paginated, PaginationHelper } from '../../common/pagination/pagination.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignExecutorService } from '../../workers/campaign-executor.service';
import { AuditService } from '../audit/audit.service';
import { CampaignFilterDto } from './dto/campaign-filter.dto';
import { CreateCampaignDto, CampaignGroupInput } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

export interface CampaignProgress {
  campaign: Campaign;
  groups: CampaignGroup[];
  postsTotal: number;
  postsDone: number;
  postsFailed: number;
}

/**
 * Gestión del ciclo de vida de campañas.
 *
 * Máquina de estados acotada:
 *   DRAFT      → (start) → SCHEDULED/RUNNING
 *   SCHEDULED  → (scheduler/start) → RUNNING  (activa grupos vía executor)
 *   RUNNING    → (pause) → PAUSED | (fin) → COMPLETED | (error) → FAILED
 *   PAUSED     → (resume) → RUNNING
 *   DRAFT/SCHEDULED → (cancel) → CANCELLED
 *
 * La ejecución real la realiza el Worker de campaña (poller sin cola externa)
 * reclamando grupos con updateMany condicional (claims atómicos en PostgreSQL).
 */
@Injectable()
export class CampaignsService implements OnModuleInit {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly pagination: PaginationHelper,
    private readonly executor: CampaignExecutorService,
    private readonly audit: AuditService,
    private readonly appLogger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    // Recuperación tras reinicio: las campañas RUNNING vuelven a materializar
    // sus grupos y a preparar el primero para que el worker lo tome.
    const stuck = await this.prisma.campaign.findMany({
      where: { status: CampaignStatus.RUNNING, startAt: { lte: new Date() } },
      take: 50,
      select: { id: true, name: true },
    });
    for (const c of stuck) {
      this.logger.warn(`Reanudando campaña ${c.id} (${c.name}) en arranque`);
      await this.executor.activateCampaignGroups(c.id);
    }
    // Las SCHEDULED pasadas las activa el CampaignSchedulerService en su primer tick.
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(userId: string, dto: CreateCampaignDto): Promise<Campaign> {
    const page = await this.prisma.page.findFirst({ where: { id: dto.pageId, userId } });
    if (!page) throw new NotFoundException('Página no encontrada o no pertenece al usuario');

    this.assertGroupsValid(dto.groups);

    const campaign = await this.prisma.campaign.create({
      data: {
        userId,
        accountId: page.accountId,
        pageId: page.id,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        contentTemplate: dto.contentTemplate,
        imageUrls: dto.imageUrls ?? [],
        videoUrl: dto.videoUrl,
        groups: dto.groups as unknown as Prisma.InputJsonValue,
        totalActions: dto.totalActions,
        intervalSeconds: dto.intervalSeconds ?? 5,
        groupsWaitSeconds: dto.groupsWaitSeconds ?? 1800,
        startAt: new Date(dto.startAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        aiGenerated: dto.aiGenerated ?? false,
        aiPrompt: dto.aiPrompt,
        aiProvider: dto.aiGenerated ? 'ai' : null,
        status: CampaignStatus.DRAFT,
        dedupeKey: this.buildDedupeKey(page.id, dto.contentTemplate),
      },
    });

    await this.audit.record({
      action: 'campaign.create',
      category: LogCategory.CAMPAIGN,
      userId,
      campaignId: campaign.id,
      metadata: { name: campaign.name },
    });
    return campaign;
  }

  async findAll(userId: string, query: CampaignFilterDto): Promise<Paginated<Campaign>> {
    const opts = this.pagination.parsePageOptions(query as unknown as Record<string, unknown> | undefined);
    const where: Prisma.CampaignWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.pageId ? { pageId: query.pageId } : {}),
      ...(query.search ? { name: { contains: query.search } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        include: { campaignGroups: true, _count: { select: { posts: true } } },
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return this.pagination.buildPaginated(rows, total, opts);
  }

  async findOne(userId: string, id: string): Promise<Campaign & { campaignGroups: CampaignGroup[] }> {
    await this.requireCampaign(userId, id);
    return this.prisma.campaign.findFirstOrThrow({
      where: { id, userId },
      include: { campaignGroups: { orderBy: { position: 'asc' } } },
    });
  }

  async update(userId: string, id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.requireCampaign(userId, id);
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new ConflictException('Solo se puede editar una campaña en estado DRAFT');
    }

    const data: Prisma.CampaignUpdateInput = {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      contentTemplate: dto.contentTemplate,
      imageUrls: dto.imageUrls,
      videoUrl: dto.videoUrl,
      groups: (dto.groups as unknown as Prisma.InputJsonValue) ?? undefined,
      totalActions: dto.totalActions,
      intervalSeconds: dto.intervalSeconds,
      groupsWaitSeconds: dto.groupsWaitSeconds,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      aiGenerated: dto.aiGenerated,
      aiPrompt: dto.aiPrompt,
    };
    if (dto.contentTemplate) {
      data.dedupeKey = this.buildDedupeKey(campaign.pageId, dto.contentTemplate);
    }

    const updated = await this.prisma.campaign.update({ where: { id }, data });
    await this.audit.record({
      action: 'campaign.update',
      category: LogCategory.CAMPAIGN,
      userId,
      campaignId: id,
    });
    return updated;
  }

  async remove(userId: string, id: string): Promise<{ success: boolean }> {
    const campaign = await this.requireCampaign(userId, id);
    const allowedStatuses: CampaignStatus[] = [CampaignStatus.DRAFT, CampaignStatus.COMPLETED, CampaignStatus.FAILED, CampaignStatus.CANCELLED];
    if (!allowedStatuses.includes(campaign.status)) {
      throw new ConflictException('Solo se pueden eliminar campañas en borrador o ya finalizadas');
    }
    await this.prisma.campaign.delete({ where: { id } });
    await this.audit.record({
      action: 'campaign.delete',
      category: LogCategory.CAMPAIGN,
      userId,
      metadata: { campaignId: id, name: campaign.name },
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Máquina de estados
  // ---------------------------------------------------------------------------

  async start(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.requireCampaign(userId, id);
    if (([CampaignStatus.RUNNING, CampaignStatus.COMPLETED] as CampaignStatus[]).includes(campaign.status)) {
      throw new ConflictException(`La campaña ya está en estado ${campaign.status}`);
    }

    const startAt = new Date(campaign.startAt);
    const ready = startAt.getTime() <= Date.now();
    const status = ready ? CampaignStatus.RUNNING : CampaignStatus.SCHEDULED;

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status, errorMessage: null },
    });
    // Si startAt ya venció, el primer grupo queda listo de inmediato para el
    // worker; si es futura, el Scheduler activará la campaña al cumplirse.
    if (ready) await this.executor.activateCampaignGroups(id);
    await this.audit.record({
      action: 'campaign.start',
      category: LogCategory.CAMPAIGN,
      userId,
      campaignId: id,
      metadata: { status },
    });
    this.appLogger.log(`Campaña ${id} activada (${status})`, 'Campaigns');
    return updated;
  }

  async pause(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.requireCampaign(userId, id);
    if (campaign.status !== CampaignStatus.RUNNING) {
      throw new ConflictException('Solo puede pausarse una campaña en RUNNING');
    }

    // PAUSED detiene al worker: los claims filtran por campaña RUNNING y se
    // liberan los leases activos para un eventual resume limpio.
    await this.prisma.campaignGroup.updateMany({
      where: { campaignId: id },
      data: { leaseExpiresAt: null },
    });
    const updated = await this.prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.PAUSED } });
    await this.audit.record({ action: 'campaign.pause', category: LogCategory.CAMPAIGN, userId, campaignId: id });
    return updated;
  }

  async resume(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.requireCampaign(userId, id);
    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new ConflictException('Solo puede reanudarse una campaña en PAUSED');
    }
    const ready = new Date(campaign.startAt).getTime() <= Date.now();
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: ready ? CampaignStatus.RUNNING : CampaignStatus.SCHEDULED },
    });
    // Deja listo el primer grupo pendiente; el claim atómico reanuda sin duplicar.
    if (ready) await this.executor.activateCampaignGroups(id);
    await this.audit.record({ action: 'campaign.resume', category: LogCategory.CAMPAIGN, userId, campaignId: id });
    return updated;
  }

  async cancel(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.requireCampaign(userId, id);
    if (([CampaignStatus.COMPLETED, CampaignStatus.FAILED, CampaignStatus.CANCELLED] as CampaignStatus[]).includes(campaign.status)) {
      throw new ConflictException(`La campaña ya terminó (${campaign.status})`);
    }
    await this.prisma.campaignGroup.updateMany({
      where: { campaignId: id },
      data: { status: GroupStatus.COMPLETED, finishedAt: new Date(), leaseExpiresAt: null },
    });
    await this.prisma.post.updateMany({
      where: { campaignId: id, status: { in: [PostStatus.SCHEDULED, PostStatus.PUBLISHING] } },
      data: { status: PostStatus.CANCELLED },
    });
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED, errorMessage: 'Cancelada por el operador' },
    });
    await this.audit.record({ action: 'campaign.cancel', category: LogCategory.CAMPAIGN, userId, campaignId: id });
    return updated;
  }

  async duplicate(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.requireCampaign(userId, id);
    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const copy = await this.prisma.campaign.create({
      data: {
        userId,
        accountId: campaign.accountId,
        pageId: campaign.pageId,
        name: `${campaign.name} (copia)`,
        description: campaign.description,
        contentTemplate: campaign.contentTemplate,
        imageUrls: (campaign.imageUrls as string[]) ?? [],
        videoUrl: campaign.videoUrl,
        groups: campaign.groups as unknown as Prisma.InputJsonValue,
        totalActions: campaign.totalActions,
        intervalSeconds: campaign.intervalSeconds,
        groupsWaitSeconds: campaign.groupsWaitSeconds,
        startAt,
        endsAt: campaign.endsAt,
        aiGenerated: campaign.aiGenerated,
        aiPrompt: campaign.aiPrompt,
        status: CampaignStatus.DRAFT,
        dedupeKey: this.buildDedupeKey(campaign.pageId, `${campaign.contentTemplate}:${startAt.getTime()}`),
      },
    });
    await this.audit.record({
      action: 'campaign.duplicate',
      category: LogCategory.CAMPAIGN,
      userId,
      campaignId: copy.id,
      metadata: { source: id },
    });
    return copy;
  }

  async getProgress(userId: string, id: string): Promise<CampaignProgress> {
    const campaign = await this.requireCampaign(userId, id);
    const [groups, postsTotal, postsDone, postsFailed] = await Promise.all([
      this.prisma.campaignGroup.findMany({ where: { campaignId: id }, orderBy: { position: 'asc' } }),
      this.prisma.post.count({ where: { campaignId: id } }),
      this.prisma.post.count({ where: { campaignId: id, status: PostStatus.PUBLISHED } }),
      this.prisma.post.count({ where: { campaignId: id, status: PostStatus.FAILED } }),
    ]);

    return { campaign, groups, postsTotal, postsDone, postsFailed };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async requireCampaign(userId: string, id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, userId } });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    return campaign;
  }

  private assertGroupsValid(groups: CampaignGroupInput[]): void {
    if (!groups.length) throw new BadRequestException('La campaña requiere al menos un grupo');
    const sum = groups.reduce((acc, g) => acc + g.percentage, 0);
    if (sum !== 100) {
      throw new BadRequestException(`La suma de porcentajes de los grupos debe ser 100 (recibido: ${sum})`);
    }
  }

  private buildDedupeKey(pageId: string, content: string): string {
    return this.crypto.hmac(`${pageId}:${content.trim()}`, 'campaign-dedupe');
  }
}