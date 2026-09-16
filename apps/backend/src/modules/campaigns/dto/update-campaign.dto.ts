import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { CampaignGroupInput } from './create-campaign.dto';

export class UpdateCampaignDto {
  @ApiPropertyOptional({ description: 'Título / nombre de la campaña' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Descripción corta (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Contenido base del post' })
  @IsOptional()
  @IsString()
  @MaxLength(63_200)
  contentTemplate?: string;

  @ApiPropertyOptional({ description: 'URLs de imágenes a adjuntar. Máximo 8.', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ description: 'URL de video (Facebook Hosting o remoto)' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'URL de enlace externo (genera tarjeta de vista previa en Facebook)' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  linkUrl?: string;

  @ApiPropertyOptional({ description: 'Grupos programados de la campaña' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignGroupInput)
  groups?: CampaignGroupInput[];

  @ApiPropertyOptional({ description: 'Acciones totales a ejecutar' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalActions?: number;

  @ApiPropertyOptional({ description: 'Intervalo base entre acciones (segundos)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  intervalSeconds?: number;

  @ApiPropertyOptional({ description: 'Espera entre grupos (segundos)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(604_800)
  groupsWaitSeconds?: number;

  @ApiPropertyOptional({ description: 'Fecha/hora de inicio (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: 'Fecha/hora de fin (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Indica si el contenido fue generado por IA' })
  @IsOptional()
  @IsBoolean()
  aiGenerated?: boolean;

  @ApiPropertyOptional({ description: 'Prompt usado para generar el contenido' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  aiPrompt?: string;
}