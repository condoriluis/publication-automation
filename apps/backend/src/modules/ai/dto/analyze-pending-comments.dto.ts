import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class AnalyzePendingCommentsDto {
  @ApiPropertyOptional({ description: 'Filtrar por página (opcional: analiza todas las del usuario)' })
  @IsOptional()
  @IsString()
  pageId?: string;

  @ApiPropertyOptional({ description: 'Máximo de comentarios a analizar por lote' })
  @ValidateIf((o: AnalyzePendingCommentsDto) => o.limit !== undefined)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}