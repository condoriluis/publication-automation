import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { RawBodyRequest } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';
import { AppLogger } from '../../common/logger/app-logger.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppConfigService as AppConfig } from '../../config/app-config.service';
import { WebhooksService } from './webhooks.service';

// Meta entrega los eventos de forma secuencial; un límite holgado permite
// ráfagas legítimas manteniendo el endpoint protegido ante abuso (sin
// @SkipThrottle).
@ApiTags('Webhooks Meta')
@Controller('webhooks/meta')
@Throttle({ default: { limit: 600, ttl: 60_000 } })
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly crypto: CryptoService,
    private readonly appConfig: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  @Get()
  @Public()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const tokenOk = token !== undefined && this.crypto.safeEqual(this.appConfig.webhookVerifyToken, token);
    if (mode === 'subscribe' && tokenOk && challenge !== undefined) {
      return challenge;
    }
    throw new ForbiddenException('Verificación del webhook rechazada');
  }

  @Post()
  @Public()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Body() body: unknown): Promise<void> {
    const signature = (req.headers?.['x-hub-signature-256'] as string | undefined) ?? '';
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    if (!this.webhooksService.verifySignature(rawBody, signature)) {
      throw new ForbiddenException('Firma inválida del webhook de Meta');
    }

    // La ingesta se hace asíncrona para no bloquear la respuesta de Meta: si
    // algo fallara, el sondeo programado (comment-poll) vuelve a descargar los
    // comentarios de los posts recientes (eventual consistency).
    void this.webhooksService.processPayload(body).catch((err: Error) => {
      this.logger.error(
        `Procesamiento asíncrono del webhook falló: ${err.message}`,
        undefined,
        'Webhooks',
      );
    });
  }
}