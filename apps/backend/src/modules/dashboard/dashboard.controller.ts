import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  DashboardService,
  DashboardSummary,
  EngagementQueryDto,
  EngagementSeries,
  SummaryQueryDto,
} from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Totales generales del panel de control' })
  summary(@Query() query: SummaryQueryDto): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(query);
  }

  @Get('engagement')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Serie de engagement y métricas de página agregada por día' })
  engagement(@Query() query: EngagementQueryDto): Promise<EngagementSeries> {
    return this.dashboardService.getEngagementSeries(query);
  }
}