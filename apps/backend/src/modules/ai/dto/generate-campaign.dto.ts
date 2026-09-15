import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class GenerateCampaignDto {
  @IsString()
  @IsNotEmpty()
  pageId!: string;

  @IsString()
  @MinLength(3)
  title!: string;
}
