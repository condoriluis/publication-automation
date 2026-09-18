import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AnalyzeCommentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  commentIds!: string[];
}