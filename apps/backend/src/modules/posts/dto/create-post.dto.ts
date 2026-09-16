import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ description: 'Página de Meta donde se publicará' })
  @IsString()
  @IsNotEmpty()
  pageId!: string;

  @ApiProperty({ description: 'Contenido del post' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(63_200)
  content!: string;

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

  @ApiPropertyOptional({ description: 'Campaña a la que pertenece el post' })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Programación futura (ISO 8601). Sin valor = borrador' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiPropertyOptional({ description: 'Indica que el contenido fue generado por IA' })
  @IsOptional()
  @IsBoolean()
  aiGenerated?: boolean;

  @ApiPropertyOptional({ description: 'Prompt usado (auditoría IA)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  aiPrompt?: string;
}