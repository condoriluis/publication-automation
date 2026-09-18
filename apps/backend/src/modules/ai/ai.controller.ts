import { Body, Controller, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService, CampaignConfigResult, CommentAnalysisResult } from './ai.service';
import { GenerateCommentReplyDto } from './dto/generate-comment-reply.dto';
import { GenerateTextDto } from './dto/generate-text.dto';
import { AnalyzeCommentsDto } from './dto/analyze-comments.dto';
import { AnalyzePendingCommentsDto } from './dto/analyze-pending-comments.dto';
import { GenerateCampaignDto } from './dto/generate-campaign.dto';

@ApiTags('Inteligencia Artificial')
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  @Permissions('ai:use')
  @ApiOperation({ summary: 'Devuelve el proveedor y modelo de IA activos (sin exponer la API key)' })
  async getStatus(): Promise<{ provider: string; model: string; configured: boolean }> {
    try {
      const config = await this.aiService.getActiveConfig();
      return { provider: config.provider, model: config.model, configured: Boolean(config.apiKey) };
    } catch {
      return { provider: 'Sin configurar', model: '—', configured: false };
    }
  }

  @Post('generate-post')
  @Permissions('ai:use')
  @ApiOperation({ summary: 'Genera el texto de una publicación para una página' })
  async generatePost(@Body() dto: GenerateTextDto, @CurrentUser('sub') userId: string): Promise<{ success: boolean; text: string }> {
    const page = await this.prisma.page.findFirst({ where: { id: dto.pageId, userId } });
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

  @Post('generate-campaign')
  @Permissions('ai:use')
  @ApiOperation({ summary: 'Genera configuración completa de campaña a partir del título' })
  async generateCampaign(@Body() dto: GenerateCampaignDto, @CurrentUser('sub') userId: string): Promise<{ success: boolean; config: CampaignConfigResult }> {
    const page = await this.prisma.page.findFirst({ where: { id: dto.pageId, userId } });
    if (!page) {
      throw new NotFoundException('Página no encontrada');
    }
    const config = await this.aiService.generateCampaignConfig({
      page: {
        id: page.id,
        name: page.name,
        category: page.category,
        description: page.description,
      },
      title: dto.title,
    });
    return { success: true, config };
  }

  @Post('comment-reply')
  @Permissions('ai:use')
  @ApiOperation({ summary: 'Sugiere una respuesta contextual a un comentario' })
  async commentReply(@Body() dto: GenerateCommentReplyDto, @CurrentUser('sub') userId: string): Promise<{ success: boolean; reply: string }> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: dto.commentId, page: { userId } },
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
  async analyzeComments(
    @Body() dto: AnalyzeCommentsDto,
    @CurrentUser('sub') userId: string,
  ): Promise<{ success: boolean; results: CommentAnalysisResult[] }> {
    const results = await this.aiService.analyzeComments(dto.commentIds, { userId });
    return { success: true, results };
  }

  @Post('analyze-pending-comments')
  @Permissions('ai:use')
  @ApiOperation({ summary: 'Analiza automáticamente los comentarios pendientes (sin clasificar) del usuario' })
  async analyzePendingComments(
    @Body() dto: AnalyzePendingCommentsDto,
    @CurrentUser('sub') userId: string,
  ): Promise<{
    success: boolean;
    requested: number;
    analyzed: CommentAnalysisResult[];
    alreadyAnalyzed: number;
  }> {
    const result = await this.aiService.analyzePendingComments(userId, dto.pageId, dto.limit);
    return { success: true, ...result };
  }
}