import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @ApiPropertyOptional({ description: 'Contenido del post' })
  @IsOptional()
  @IsString()
  @MaxLength(63_200)
  content?: string;

  @ApiPropertyOptional({ description: 'URLs de imágenes a adjuntar. Máximo 8.', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ description: 'URL de video' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Programación futura (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}