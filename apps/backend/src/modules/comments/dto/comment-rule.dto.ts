import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { CommentClassification, CommentRuleAction } from '@prisma/client';

export class CreateCommentRuleDto {
  @ApiProperty({ description: 'Página de la que depende la regla' })
  @IsUUID()
  pageId!: string;

  @ApiProperty({ description: 'Nombre descriptivo de la regla' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Si la regla está activa' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Substrings (minúsculas) que deben aparecer en el mensaje. Vacío = sin filtro por palabra',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    enum: CommentClassification,
    isArray: true,
    description: 'Clasificaciones de IA que disparan la regla. Vacío = cualquier clasificación',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsEnum(CommentClassification, { each: true })
  classifications?: CommentClassification[];

  @ApiPropertyOptional({
    type: Number,
    description: 'Solo aplicar si la confianza de la IA es <= este valor (0-100). Null = sin filtro',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxConfidence?: number;

  @ApiProperty({ enum: CommentRuleAction, description: 'Acción a ejecutar' })
  @IsEnum(CommentRuleAction)
  action!: CommentRuleAction;

  @ApiPropertyOptional({
    description:
      'Plantilla de respuesta (se sustituye {nombre}). Obligatoria si action = REPLY. En su defecto se genera con IA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  replyTemplate?: string;
}

export class UpdateCommentRuleDto {
  @ApiPropertyOptional({ description: 'Nombre descriptivo de la regla' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Si la regla está activa' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Substrings (minúsculas) que deben aparecer en el mensaje',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    enum: CommentClassification,
    isArray: true,
    description: 'Clasificaciones de IA que disparan la regla',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsEnum(CommentClassification, { each: true })
  classifications?: CommentClassification[];

  @ApiPropertyOptional({
    type: Number,
    description: 'Solo aplicar si la confianza de la IA es <= este valor (0-100)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxConfidence?: number;

  @ApiPropertyOptional({ enum: CommentRuleAction, description: 'Acción a ejecutar' })
  @IsOptional()
  @IsEnum(CommentRuleAction)
  action?: CommentRuleAction;

  @ApiPropertyOptional({ description: 'Plantilla de respuesta' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  replyTemplate?: string;
}