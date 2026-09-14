import { Body, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService, CommentAnalysisResult } from './ai.service';
import { GenerateCommentReplyDto } from './dto/generate-comment-reply.dto';
import { GenerateTextDto } from './dto/generate-text.dto';
import { AnalyzeCommentsDto } from './dto/analyze-comments.dto';

@ApiTags('Inteligencia Artificial')
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('generate-post')
  @Permissions('ai:use')
  @ApiOperation({ summary: 'Genera el texto de una publicación para una página' })
  async generatePost(@Body() dto: GenerateTextDto): Promise<{ success: boolean; text: string }> {
    const page = await this.prisma.page.findUnique({ where: { id: dto.pageId } });
    if (!page) {
      throw new NotFoundException('Página no encontrada');
    }
    const text = await this.aiService.generatePostText({
      page: {
        id: page.id,
        name: page.name,
        category: page.category,
        description: page.description,
      },
      theme: dto.theme,
      audience: dto.audience,
      tone: dto.tone,
      length: dto.length,
    });
    return { success: true, text };
  }

  @Post('comment-reply')
  @Permissions('ai:use')
  @ApiOperation({ summary: 'Sugiere una respuesta contextual a un comentario' })
  async commentReply(@Body() dto: GenerateCommentReplyDto): Promise<{ success: boolean; reply: string }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: dto.commentId },
      include: { post: { include: { page: true } }, page: true },
    });
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }
    const reply = await this.aiService.generateCommentReply({
      comment: {
        id: comment.id,
        message: comment.message,
        fromName: comment.fromName,
        isFromPage: comment.isFromPage,
      },
      post: {
        id: comment.post.id,
        content: comment.post.content,
        metaPermalinkUrl: comment.post.metaPermalinkUrl,
      },
      page: {
        id: comment.page.id,
        name: comment.page.name,
        category: comment.page.category,
        description: comment.page.description,
      },
      tone: dto.tone,
    });
    return { success: true, reply };
  }

  @Post('analyze-comments')
  @Permissions('ai:use')
  @ApiOperation({ summary: 'Clasifica comentarios por riesgo y tono sin ejecutar acciones' })
  async analyzeComments(@Body() dto: AnalyzeCommentsDto): Promise<{ success: boolean; results: CommentAnalysisResult[] }> {
    const results = await this.aiService.analyzeComments(dto.commentIds);
    return { success: true, results };
  }
}