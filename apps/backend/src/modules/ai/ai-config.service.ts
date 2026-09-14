import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_DEFAULT_BASE_URLS, AiProviderName } from './ai.constants';

export interface ActiveAiConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

const DEFAULT_SYSTEM_PROMPT = 'You are a professional social media assistant.';

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
      const apiKey = this.crypto.decrypt(row.apiKeyEncrypted);
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
      maxTokens: 1024,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    };
  }
}