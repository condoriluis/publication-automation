import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignFilterDto } from './dto/campaign-filter.dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @Permissions('campaigns:write')
  @ApiOperation({ summary: 'Crear una campaña (borrador)' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(userId, dto);
  }

  @Get()
  @Permissions('campaigns:read')
  @ApiOperation({ summary: 'Listar campañas (paginado + filtros)' })
  findAll(@CurrentUser('sub') userId: string, @Query() query: CampaignFilterDto) {
    return this.campaignsService.findAll(userId, query);
  }

  @Get(':id')
  @Permissions('campaigns:read')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Detalle de campaña' })
  findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.campaignsService.findOne(userId, id);
  }

  @Patch(':id')
  @Permissions('campaigns:write')
  @ApiOperation({ summary: 'Actualizar campaña (solo DRAFT)' })
  update(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(userId, id, dto);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('campaigns:write')
  @ApiOperation({ summary: 'Iniciar campaña (activa grupos para el worker)' })
  start(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.campaignsService.start(userId, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('campaigns:write')
  @ApiOperation({ summary: 'Pausar campaña en curso' })
  pause(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.campaignsService.pause(userId, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('campaigns:write')
  @ApiOperation({ summary: 'Reanudar campaña pausada' })
  resume(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.campaignsService.resume(userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('campaigns:write')
  @ApiOperation({ summary: 'Cancelar campaña no ejecutada' })
  cancel(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.campaignsService.cancel(userId, id);
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('campaigns:write')
  @ApiOperation({ summary: 'Duplicar campaña como borrador' })
  duplicate(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.campaignsService.duplicate(userId, id);
  }

  @Get(':id/progress')
  @Permissions('campaigns:read')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Progreso en vivo de la campaña' })
  progress(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.campaignsService.getProgress(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('campaigns:write')
  @ApiOperation({ summary: 'Eliminar campaña en DRAFT' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.campaignsService.remove(userId, id);
  }
}