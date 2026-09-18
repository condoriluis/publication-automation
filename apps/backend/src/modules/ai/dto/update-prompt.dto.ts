import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePromptDto {
  /** Instrucciones de la función (la app agrega solas el contexto de la página y la seguridad). */
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  systemPrompt?: string;

  /** null en la DB = heredar AIConfig.temperature; aquí solo se envían valores concretos. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  /** null en la DB = heredar AIConfig.maxTokens. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65536)
  maxTokens?: number;
}