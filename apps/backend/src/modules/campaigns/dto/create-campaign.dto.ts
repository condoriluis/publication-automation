import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignGroupInput {
  @ApiProperty({ description: 'Porcentaje de acciones del grupo (1-100); la suma debe dar 100' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  percentage!: number;

  @ApiProperty({ description: 'Intervalo entre acciones del grupo (segundos)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  intervalSeconds!: number;

  @ApiPropertyOptional({ description: 'Espera tras completar el grupo (segundos)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(604_800)
  waitAfterSeconds?: number;
}

export class CreateCampaignDto {
  @ApiProperty({ description: 'Página de Meta a la que pertenece la campaña' })
  @IsString()
  @IsNotEmpty()
  pageId!: string;

  @ApiProperty({ description: 'Título / nombre de la campaña' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Descripción corta (opcional)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Contenido base del post (puede venir generado por IA)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63_200)
  contentTemplate!: string;

  @ApiPropertyOptional({ description: 'URLs de imágenes a adjuntar. Máximo 8.', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ description: 'URL de video (Facebook Hosting o remoto)' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  videoUrl?: string;

  @ApiProperty({ description: 'Grupos programados de la campaña (distribución de acciones)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignGroupInput)
  groups!: CampaignGroupInput[];

  @ApiProperty({ description: 'Acciones totales a ejecutar (posts publicados en la página)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalActions!: number;

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

  @ApiProperty({ description: 'Fecha/hora de inicio de la campaña (ISO 8601)' })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({ description: 'Fecha/hora de fin (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Indica si el contenido fue generado por IA' })
  @IsOptional()
  @IsBoolean()
  aiGenerated?: boolean;

  @ApiPropertyOptional({ description: 'Prompt usado para generar el contenido (auditoría IA)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  aiPrompt?: string;
}