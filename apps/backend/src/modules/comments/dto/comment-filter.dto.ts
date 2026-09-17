import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { CommentClassification, CommentStatus, RiskLevel } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';

export class CommentFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por post' })
  @IsOptional()
  @IsString()
  postId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por página' })
  @IsOptional()
  @IsString()
  pageId?: string;

  @ApiPropertyOptional({ enum: RiskLevel, description: 'Filtrar por nivel de riesgo (IA)' })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({ enum: CommentStatus, description: 'Filtrar por estado' })
  @IsOptional()
  @IsEnum(CommentStatus)
  status?: CommentStatus;

  @ApiPropertyOptional({
    enum: CommentClassification,
    description: 'Filtrar por clasificación de la IA',
  })
  @IsOptional()
  @IsEnum(CommentClassification)
  classification?: CommentClassification;

  @ApiPropertyOptional({ description: 'Solo comentarios que requieren revisión humana' })
  @IsOptional()
  @IsString()
  needsReview?: 'true' | 'false';

  @ApiPropertyOptional({ description: 'Solo comentarios que requieren moderación' })
  @IsOptional()
  @IsString()
  needsModeration?: 'true' | 'false';

  @ApiPropertyOptional({ description: 'Buscar por texto del comentario' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Solo comentarios pendientes de análisis IA (sin clasificar)' })
  @IsOptional()
  @IsString()
  needsAnalysis?: 'true' | 'false';
}