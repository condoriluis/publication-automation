import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export const AI_USAGE_STATUSES = ['SUCCESS', 'ERROR'] as const;

export class AiUsageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  feature?: string;

  @IsOptional()
  @IsIn(AI_USAGE_STATUSES)
  status?: (typeof AI_USAGE_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}