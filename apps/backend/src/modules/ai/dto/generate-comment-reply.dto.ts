import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateCommentReplyDto {
  @IsString()
  @IsNotEmpty()
  commentId!: string;

  @IsOptional()
  @IsString()
  tone?: string;
}