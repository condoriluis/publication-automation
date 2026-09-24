import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { QueryPagesDto } from './dto/query-pages.dto';
import { QueryMetricsDto } from './dto/query-metrics.dto';
import { SyncPagesDto } from './dto/sync-pages.dto';
import { UpdatePageSettingsDto } from './dto/update-page-settings.dto';
import { PagesService } from './pages.service';

const DEFAULT_METRICS_RANGE_DAYS = 30;

@Controller('pages')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @Permissions('pages:read')
  async list(@CurrentUser('sub') userId: string, @Query() query: QueryPagesDto) {
    return this.pages.findAll(userId, query);
  }

  @Get(':id')
  @Permissions('pages:read')
  async get(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.pages.findOne(userId, id);
  }

  @Patch(':id')
  @Permissions('pages:write')
  async updateSettings(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePageSettingsDto,
  ) {
    return this.pages.updateSettings(userId, id, dto);
  }

  @Post('accounts/:accountId/sync')
  @Permissions('pages:write')
  async syncAccount(
    @CurrentUser('sub') userId: string,
    @Param('accountId') accountId: string,
  ) {
    return this.pages.syncAccount(userId, accountId);
  }

  @Post(':id/sync')
  @Permissions('pages:write')
  async sync(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: SyncPagesDto) {
    return this.pages.syncPage(userId, id, dto);
  }

  @Get(':id/metrics')
  @Permissions('pages:read')
  async metrics(@CurrentUser('sub') userId: string, @Param('id') id: string, @Query() query: QueryMetricsDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_METRICS_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return this.pages.getMetrics(userId, id, from, to);
  }
}