import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Ajustes operativos de una página (PATCH /pages/:id).
 * Se persisten como JSON en AppSetting con key `page:settings:{pageId}`.
 */
export class UpdatePageSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoReplyEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  moderateToxicity?: boolean;

  @IsOptional()
  @IsBoolean()
  hideToxicComments?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  replyTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  aiModel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  maxAutoRepliesPerPost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  minResponseDelaySeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  maxResponseDelaySeconds?: number;
}