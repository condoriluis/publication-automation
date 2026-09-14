import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyCommentDto {
  @ApiProperty({ description: 'Texto de la respuesta pública del comentario' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ description: 'Tono sugerido (se ignora si se usa IA)' })
  @IsOptional()
  @IsString()
  tone?: string;
}

export class AutoReplyAiDto {
  @ApiProperty({ enum: ['neutral', 'friendly', 'formal', 'brief'], description: 'Tono de la respuesta generada' })
  @IsOptional()
  @IsIn(['neutral', 'friendly', 'formal', 'brief'])
  tone?: 'neutral' | 'friendly' | 'formal' | 'brief';
}