import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

import { CampaignStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export class CampaignFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CampaignStatus, description: 'Filtrar por un único estado' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ description: 'Estados separados por coma (p.ej. DRAFT,SCHEDULED,RUNNING)' })
  @IsOptional()
  @Matches(
    /^(DRAFT|SCHEDULED|RUNNING|PAUSED|COMPLETED|FAILED|CANCELLED)(,(DRAFT|SCHEDULED|RUNNING|PAUSED|COMPLETED|FAILED|CANCELLED))*$/,
    { message: 'statuses contiene estados inválidos' },
  )
  statuses?: string;

  @ApiPropertyOptional({ description: 'Filtrar por página' })
  @IsOptional()
  @IsString()
  pageId?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre' })
  @IsOptional()
  @IsString()
  search?: string;
}