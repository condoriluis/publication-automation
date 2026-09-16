import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LogCategory } from '@prisma/client';
import { Roles } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { parsePageOptions } from '../../common/pagination/pagination.helper';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN', 'MANAGER')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('category') category?: string,
    @Query('userId') userId?: string,
    @Query('pageId') pageId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.audit.findAll(
      {
        action,
        category: category && Object.values(LogCategory).includes(category as LogCategory) ? (category as LogCategory) : undefined,
        userId,
        pageId,
        campaignId,
        from,
        to,
      },
      parsePageOptions({ page, limit }),
    );
  }
}