import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CommentRulesService } from './comment-rules.service';
import { CreateCommentRuleDto, UpdateCommentRuleDto } from './dto/comment-rule.dto';

@ApiTags('comment-rules')
@ApiBearerAuth()
@Controller('comment-rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentRulesController {
  constructor(private readonly rulesService: CommentRulesService) {}

  @Get()
  @Permissions('comments:read')
  @ApiOperation({ summary: 'Listar reglas de automatización de una página' })
  list(@CurrentUser('sub') userId: string, @Query('pageId') pageId: string) {
    return this.rulesService.list(userId, pageId);
  }

  @Post()
  @Permissions('comments:write')
  @ApiOperation({ summary: 'Crear una regla de automatización de comentarios' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateCommentRuleDto) {
    return this.rulesService.create(userId, dto);
  }

  @Patch(':id')
  @Permissions('comments:write')
  @ApiOperation({ summary: 'Actualizar una regla de automatización' })
  update(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateCommentRuleDto) {
    return this.rulesService.update(userId, id, dto);
  }

  @Delete(':id')
  @Permissions('comments:write')
  @ApiOperation({ summary: 'Eliminar una regla de automatización' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.rulesService.remove(userId, id);
  }
}