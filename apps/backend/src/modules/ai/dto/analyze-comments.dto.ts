import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AnalyzeCommentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  commentIds!: string[];
}