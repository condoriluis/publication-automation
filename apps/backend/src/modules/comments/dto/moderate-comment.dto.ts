import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ModerateCommentDto {
  @ApiProperty({ enum: ['hide', 'unhide', 'delete'], description: 'Acción de moderación a ejecutar en Meta' })
  @IsIn(['hide', 'unhide', 'delete'])
  action!: 'hide' | 'unhide' | 'delete';
}