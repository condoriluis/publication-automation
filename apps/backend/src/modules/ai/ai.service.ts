import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { AIConfigService } from './ai-config.service';
import {
  AI_MAX_TOKENS,
  ANALYZE_SYSTEM_PROMPT,
  COMMENT_REPLY_SYSTEM_PROMPT,
  CommentRisk,
  GENERATE_POST_SYSTEM_PROMPT,
  MODERATE_SYSTEM_PROMPT,
  PostLength,
  POST_LENGTH_HINTS,
} from './ai.constants';

/** Se lanza cuando la IA no está configurada o el proveedor no responde. */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export interface AiReplyInput {
  pageName?: string;
  postText?: string;
  commentMessage: string;
  tone?: string;
}

export interface GeneratePostInput {
  page: { id: string; name: string; category?: string | null; description?: string | null };
  theme: string;
  audience?: string;
  tone?: string;
  length?: PostLength;
}

export interface GenerateCampaignConfigInput {
  page: { id: string; name: string; category?: string | null; description?: string | null };
  title: string;
}

export interface CampaignConfigResult {
  description: string;
  contentTemplate: string;
  intervalSeconds: number;
}

export interface GenerateCommentReplyInput {
  comment: { id: string; message: string; fromName?: string | null; isFromPage: boolean };
  post: { id: string; content: string; metaPermalinkUrl?: string | null };
  page: { id: string; name: string; category?: string | null; description?: string | null };
  tone?: string;
}

export interface CommentAnalysisResult {
  commentId: string;
  message: string;
  riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  sentiment?: string;
  suggestedAction?: string;
  explanation?: string;
}

@Injectable()
export class AiService {
  constructor(
    private readonly config: AppConfigService,
    private readonly aiConfig: AIConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) { }

  get isEnabled(): boolean {
    return Boolean(this.config.aiApiKey || this.aiConfig);
  }

  /** Expone la configuración activa (sin API key) para el endpoint de estado. */
  async getActiveConfig() {
    return this.aiConfig.getActive();
  }

  /** Respuesta de iaReply natural para un comentario de seguidor (workers). */
  async generateReply(input: AiReplyInput): Promise<string> {
    const system = [
      'Eres un community manager profesional, cercano y respetuoso.',
      input.pageName ? `Escribes en representación de la página "${input.pageName}".` : '',
      'Responde con naturalidad, brevedad y en el mismo idioma del seguidor.',
    ]
      .filter(Boolean)
      .join(' ');
    const user = [
      'Escribe una respuesta para el siguiente comentario de un seguidor:',
      input.postText ? `Contexto del post: ${input.postText}` : '',
      `\n${input.commentMessage}`,
      input.tone ? `Tono requerido: ${input.tone}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return this.chat(system, user, { maxTokens: 300 });
  }

  /** Genera el texto de una publicación para una página. */
  async generatePostText(input: GeneratePostInput): Promise<string> {
    const hints = input.length ? POST_LENGTH_HINTS[input.length] : 'Extensión: texto adecuado según el tema.';
    const system = GENERATE_POST_SYSTEM_PROMPT;

    const user = [
      `Página: "${input.page.name}".`,
      input.page.category ? `Categoría: ${input.page.category}.` : '',
      input.page.description ? `Descripción: ${input.page.description}.` : '',
      `Tema solicitado: ${input.theme}.`,
      input.audience ? `Audiencia objetivo: ${input.audience}.` : 'Analiza el tema y deduce la audiencia objetivo.',
      input.tone ? `Tono: ${input.tone}.` : 'Usa un tono altamente persuasivo y adecuado para la red social.',
      hints,
      `Seed de variabilidad (ignóralo, es solo para forzar contenido único): ${Math.random().toString(36).substring(7)}`,
      'Redacta la publicación de Facebook ahora.',
    ]
      .filter(Boolean)
      .join('\n');

    return this.chat(system, user);
  }

  /** Genera automáticamente la configuración de una campaña a partir del título. */
  async generateCampaignConfig(input: GenerateCampaignConfigInput): Promise<CampaignConfigResult> {
    const system =
      'Eres un experto en marketing digital y copywriter certificado en politicas de Meta. ' +
      'Disena la configuracion inicial de una campana automatizada para Facebook. ' +
      'REGLAS para el contentTemplate: ' +
      '1) Texto plano: CERO asteriscos, CERO guiones, CERO Markdown. ' +
      '2) Usa emojis como vinetas (cuadro verde, cohete, bombilla, rayo). ' +
      '3) ESTRUCTURA: Titular impactante, 3 puntos clave con emojis, Pregunta abierta, 3-5 hashtags. ' +
      '4) Sin metricas inventadas ni afirmaciones enganosas (cumplimiento Meta). ' +
      'Responde SOLO con JSON valido, sin texto extra: ' +
      '{"description":"Justificacion breve (1-2 frases)","contentTemplate":"Post completo con estructura viral","intervalSeconds":3600}';

    const user = [
      `Pagina: "${input.page.name}"${input.page.category ? ` (${input.page.category})` : ''}.`,
      input.page.description ? `Negocio: ${input.page.description}.` : '',
      `Titulo de la campana: ${input.title}.`,
      `Seed: ${Math.random().toString(36).substring(7)}`,
      'Genera el JSON ahora.',
    ].filter(Boolean).join('\n');

    const raw = await this.chat(system, user);
    return this.parseAiJson<CampaignConfigResult>(raw);
  }

  /** Sugiere una respuesta contextual a un comentario. */
  async generateCommentReply(input: GenerateCommentReplyInput): Promise<string> {
    const system = COMMENT_REPLY_SYSTEM_PROMPT;
    const user = [
      `Página: "${input.page.name}"${input.page.category ? ` (${input.page.category})` : ''}.`,
      'Post original del usuario:',
      `  ${input.post.content || '(sin texto, publicación de imagen/video)'}`,
      `Comentario del usuario "${input.comment.fromName ?? 'anónimo'}" :`,
      `  ${input.comment.message}`,
      input.tone ? `Tono de la respuesta solicitado: ${input.tone}.` : '',
      'Redacta la respuesta pública ahora.',
    ]
      .filter(Boolean)
      .join('\n');

    return this.chat(system, user, { maxTokens: 300 });
  }

  async analyzeComments(commentIds: string[]): Promise<CommentAnalysisResult[]> {
    const results: CommentAnalysisResult[] = [];
    for (const commentId of commentIds) {
      const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
      if (!comment) {
        this.logger.warn(`Comentario ${commentId} no encontrado en la base de datos`);
        continue;
      }

      let parsed: { categoria: CommentRisk; sentimiento: string; tema: string; razon: string };
      try {
        const raw = await this.chat(ANALYZE_SYSTEM_PROMPT, `Comentario:\n${comment.message}\nClasifícalo.`);
        parsed = this.parseAiJson<{ categoria: CommentRisk; sentimiento: string; tema: string; razon: string }>(raw);
      } catch (err) {
        this.logger.warn(`Fallo IA al analizar comentario ${commentId}: ${(err as Error).message}`);
        continue;
      }

      const riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' =
        parsed.categoria === 'PELIGROSO'
          ? 'HIGH'
          : parsed.categoria === 'OPORTUNIDAD'
            ? 'LOW'
            : 'NONE';

      const suggestedAction =
        riskLevel === 'HIGH' ? 'hide' : riskLevel === 'LOW' ? 'reply' : 'none';

      await this.prisma.comment.update({
        where: { id: commentId },
        data: { riskLevel, analyzedAt: new Date() },
      });

      // Mapeamos los campos al contrato que espera el frontend
      results.push({
        commentId,
        message: comment.message,
        riskLevel,
        sentiment: parsed.sentimiento,
        suggestedAction,
        explanation: `${parsed.tema} — ${parsed.razon}`,
      });
    }
    return results;
  }

  /** Propone una acción de moderación sin ejecutarla. */
  async moderateComment(comment: { message: string }): Promise<{
    categoria: CommentRisk;
    accionSugerida: 'reply' | 'hide' | 'delete' | 'none';
    justificacion: string;
    respuestaSugerida?: string;
  }> {
    const raw = await this.chat(MODERATE_SYSTEM_PROMPT, `Comentario:\n${comment.message}`);
    return this.parseAiJson<{
      categoria: CommentRisk;
      accionSugerida: 'reply' | 'hide' | 'delete' | 'none';
      justificacion: string;
      respuestaSugerida?: string;
    }>(raw);
  }

  // ---------------------------------------------------------------------------
  // Transporte multi-proveedor
  // ---------------------------------------------------------------------------

  private async chat(system: string, user: string, opts?: { maxTokens?: number }): Promise<string> {
    const { provider, model, apiKey, baseUrl } = await this.aiConfig.getActive();
    if (!apiKey) throw new AiUnavailableError('Servicio de IA no disponible: falta API key configurada');

    const maxTokens = opts?.maxTokens ?? AI_MAX_TOKENS;

    let attempts = 0;
    while (attempts < 3) {
      try {
        if (provider === 'anthropic') {
          return await this.chatAnthropic({ baseUrl, model, apiKey, system, user, maxTokens });
        }
        if (provider === 'google') {
          return await this.chatGoogle({ baseUrl, model, apiKey, system, user, maxTokens });
        }
        return await this.chatOpenAiCompatible({ baseUrl, model, apiKey, system, user, maxTokens });
      } catch (err: any) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 401 || status === 403) {
            throw new AiUnavailableError('API Key de IA inválida o sin permisos (HTTP 401/403). Revisa la configuración.');
          }
          if (status === 429) {
            throw new AiUnavailableError('Límite de cuota, tokens o saldo excedido en el proveedor de IA (HTTP 429). Revisa tu cuenta.');
          }
        }

        attempts++;
        if (attempts >= 3) {
          throw err instanceof AiUnavailableError
            ? err
            : new AiUnavailableError(`Error en el proveedor de IA: ${err.message || 'Desconocido'}`);
        }
        // Backoff antes de reintentar
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    throw new AiUnavailableError('Fallaron todos los reintentos al contactar la IA.');
  }

  private async chatOpenAiCompatible(args: {
    baseUrl: string;
    model: string;
    apiKey: string;
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<string> {
    const baseUrl = args.baseUrl.replace(/\/$/, '');
    const { data } = await axios.post<{ choices?: Array<{ message?: { content?: string } }> }>(
      `${baseUrl}/chat/completions`,
      {
        model: args.model,
        temperature: 0.7,
        max_tokens: args.maxTokens,
        messages: [
          { role: 'system', content: args.system },
          { role: 'user', content: args.user },
        ],
      },
      { headers: { Authorization: `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' }, timeout: 60_000 },
    );
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      this.logger.error(`Respuesta de IA vacía o malformada. Data: ${JSON.stringify(data)}`);
      throw new AiUnavailableError('El proveedor de IA devolvió una respuesta vacía');
    }
    this.logger.debug(`IA (openai-compatible) generó ${content.length} chars`);
    return content;
  }

  private async chatAnthropic(args: {
    baseUrl: string;
    model: string;
    apiKey: string;
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<string> {
    const baseUrl = args.baseUrl.replace(/\/$/, '');
    const { data } = await axios.post<{ content?: Array<{ text?: string }> }>(
      `${baseUrl}/v1/messages`,
      {
        model: args.model,
        max_tokens: args.maxTokens,
        system: args.system,
        messages: [{ role: 'user', content: args.user }],
      },
      {
        headers: {
          'x-api-key': args.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      },
    );
    const content = data.content?.find((c) => c.text)?.text?.trim();
    if (!content) throw new AiUnavailableError('El proveedor de IA devolvió una respuesta vacía');
    this.logger.debug(`IA (anthropic) generó ${content.length} chars`);
    return content;
  }

  private async chatGoogle(args: {
    baseUrl: string;
    model: string;
    apiKey: string;
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<string> {
    const baseUrl = args.baseUrl.replace(/\/$/, '');
    const { data } = await axios.post<{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }>(
      `${baseUrl}/models/${encodeURIComponent(args.model)}:generateContent`,
      {
        system_instruction: { parts: [{ text: args.system }] },
        contents: [{ role: 'user', parts: [{ text: args.user }] }],
        generationConfig: { maxOutputTokens: args.maxTokens, temperature: 0.7 },
      },
      {
        params: { key: args.apiKey },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60_000,
      },
    );
    const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim();
    if (!content) throw new AiUnavailableError('El proveedor de IA devolvió una respuesta vacía');
    this.logger.debug(`IA (google) generó ${content.length} chars`);
    return content;
  }

  /** Extrae JSON de la respuesta del modelo, tolerando fences de código. */
  private parseAiJson<T>(raw: string): T {
    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new AiUnavailableError('El modelo no devolvió JSON parseable');
    }
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}