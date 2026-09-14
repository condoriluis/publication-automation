import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CommentsService } from './comments.service';
import { CommentFilterDto } from './dto/comment-filter.dto';
import { ReplyCommentDto } from './dto/reply-comment.dto';
import { AutoReplyAiDto } from './dto/reply-comment.dto';
import { ModerateCommentDto } from './dto/moderate-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller('comments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @Permissions('comments:read')
  @ApiOperation({ summary: 'Listar comentarios (paginado + filtros)' })
  findAll(@CurrentUser('sub') userId: string, @Query() query: CommentFilterDto) {
    return this.commentsService.findAll(userId, query);
  }

  @Get(':id')
  @Permissions('comments:read')
  @ApiOperation({ summary: 'Detalle de comentario' })
  findOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.commentsService.findOne(userId, id);
  }

  @Post('sync/:postId')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('comments:write')
  @ApiOperation({ summary: 'Sincronizar comentarios del post desde la Graph API (solo lectura)' })
  sync(@CurrentUser('sub') userId: string, @Param('postId') postId: string) {
    return this.commentsService.syncFromFacebook(userId, postId);
  }

  @Post(':id/reply')
  @Permissions('comments:write')
  @ApiOperation({ summary: 'Responder públicamente al comentario' })
  reply(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: ReplyCommentDto) {
    return this.commentsService.reply(userId, id, dto);
  }

  @Post(':id/auto-reply')
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions('comments:write', 'ai:use')
  @ApiOperation({ summary: 'Programar respuesta IA (el Worker la genera y publica)' })
  autoReply(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: AutoReplyAiDto) {
    return this.commentsService.autoReply(userId, id, dto.tone);
  }

  @Post(':id/moderate')
  @Permissions('comments:moderate')
  @ApiOperation({ summary: 'Ocultar / mostrar / eliminar comentario en Meta' })
  moderate(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: ModerateCommentDto) {
    return this.commentsService.moderate(userId, id, dto);
  }
}