import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_DEFAULT_BASE_URLS, AI_MAX_TOKENS, AiProviderName } from './ai.constants';
import { UpdateAiConfigDto } from './dto/update-ai-config.dto';

export interface ActiveAiConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

/** Vista segura de la config activa: nunca expone la API key completa. */
export interface AiConfigView {
  provider: string;
  model: string;
  baseUrl: string;
  usesDefaultBaseUrl: boolean;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  apiKeyMasked: string | null;
}

const DEFAULT_SYSTEM_PROMPT = 'You are a professional social media assistant.';

function maskKey(key?: string): string | null {
  if (!key) return null;
  if (key.length <= 4) return '••••';
  return `••••••••${key.slice(-4)}`;
}

/**
 * Resuelve la configuración activa del proveedor de IA.
 *
 * Prioridad:
 *   1. Fila `AIConfig.isDefault` de la base (clave cifrada con AES-256-GCM).
 *   2. Variables de entorno (AI_PROVIDER/AI_MODEL/AI_API_KEY/AI_BASE_URL).
 *
 * La clave de la base, si existe, tiene prioridad porque el operador la
 * gestiona desde el panel. Sin fila ni env se lanza AiUnavailableError.
 */
@Injectable()
export class AIConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly appConfig: AppConfigService,
  ) {}

  async getActive(): Promise<ActiveAiConfig> {
    const row = await this.prisma.aIConfig.findFirst({
      where: { isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (row && row.apiKeyEncrypted) {
      const apiKey = this.crypto.decrypt(row.apiKeyEncrypted, { hexKey: this.appConfig.tokenEncryptionKey });
      if (apiKey) {
        const provider = (row.provider as AiProviderName) in AI_DEFAULT_BASE_URLS
          ? (row.provider as AiProviderName)
          : 'openai';
        return {
          provider,
          model: row.model,
          apiKey,
          baseUrl: row.baseUrl ?? AI_DEFAULT_BASE_URLS[provider],
          temperature: row.temperature,
          maxTokens: row.maxTokens,
          systemPrompt: row.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        };
      }
    }

    // Fallback a entorno (desarrollo / ausencia de configuración en DB).
    const providerRaw = this.appConfig.aiProvider;
    const provider = (providerRaw as AiProviderName) in AI_DEFAULT_BASE_URLS
      ? (providerRaw as AiProviderName)
      : 'openai';
    return {
      provider,
      model: this.appConfig.aiModel,
      apiKey: this.appConfig.aiApiKey ?? '',
      baseUrl: this.appConfig.aiBaseUrl ?? AI_DEFAULT_BASE_URLS[provider],
      temperature: 0.7,
      maxTokens: AI_MAX_TOKENS,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    };
  }

  /** Vista segura para la UI: datos activos sin exponer la API key completa. */
  async getPublic(): Promise<AiConfigView> {
    const active = await this.getActive();
    const baseUrl = active.baseUrl || (AI_DEFAULT_BASE_URLS[active.provider as AiProviderName] ?? '');
    return {
      provider: active.provider,
      model: active.model,
      baseUrl,
      usesDefaultBaseUrl: baseUrl === AI_DEFAULT_BASE_URLS[active.provider as AiProviderName],
      temperature: active.temperature,
      maxTokens: active.maxTokens,
      systemPrompt: active.systemPrompt,
      apiKeyMasked: maskKey(active.apiKey),
    };
  }

  /**
   * Persiste la config en la fila `AIConfig` (isDefault). La API key nueva se
   * cifra con AES-256-GCM; si no se envía, la actual se conserva intacta.
   */
  async updateConfig(input: UpdateAiConfigDto): Promise<AiConfigView> {
    const existing = await this.prisma.aIConfig.findFirst({ where: { isDefault: true } });

    const data: {
      provider?: string;
      model?: string;
      baseUrl?: string | null;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      apiKeyEncrypted?: string;
    } = {};

    if (input.provider !== undefined) {
      if (!(input.provider in AI_DEFAULT_BASE_URLS)) {
        throw new Error(`Proveedor de IA no soportado: ${input.provider}`);
      }
      data.provider = input.provider;
    }
    if (input.model !== undefined) data.model = input.model.trim();
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl.trim() || null;
    if (input.temperature !== undefined) data.temperature = input.temperature;
    if (input.maxTokens !== undefined) data.maxTokens = input.maxTokens;
    if (input.systemPrompt !== undefined) data.systemPrompt = input.systemPrompt;
    if (input.apiKey !== undefined && input.apiKey.trim() !== '') {
      data.apiKeyEncrypted = this.crypto.encrypt(input.apiKey.trim(), {
        hexKey: this.appConfig.tokenEncryptionKey,
      });
    }

    const base = existing ?? {
      id: 'default',
      provider: 'openai',
      apiKeyEncrypted: '',
      model: 'gpt-4o-mini',
      baseUrl: null as string | null,
      temperature: 0.7,
      maxTokens: 1024,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      isDefault: true,
      updatedAt: new Date(),
    };

    await this.prisma.aIConfig.upsert({
      where: { id: 'default' },
      create: { ...base, ...data },
      update: data,
    });

    return this.getPublic();
  }
}