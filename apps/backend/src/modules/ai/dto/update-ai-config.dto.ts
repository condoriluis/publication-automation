import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { AI_PROVIDERS } from '../ai.constants';

export class UpdateAiConfigDto {
  @IsOptional()
  @IsIn(AI_PROVIDERS)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf((o) => o.baseUrl !== '' && o.baseUrl !== undefined)
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65536)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
}