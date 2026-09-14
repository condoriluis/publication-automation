import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { POST_LENGTHS, PostLength } from '../ai.constants';

export class GenerateTextDto {
  @IsString()
  @IsNotEmpty()
  pageId!: string;

  @IsString()
  @MinLength(3)
  theme!: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsIn(POST_LENGTHS)
  length?: PostLength;
}